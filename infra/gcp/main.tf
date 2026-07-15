locals {
  bucket_name = var.video_bucket_name != "" ? var.video_bucket_name : "${var.project_id}-help-review-videos"
  required_services = toset([
    "aiplatform.googleapis.com",
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com",
    "eventarc.googleapis.com",
    "iamcredentials.googleapis.com",
    "pubsub.googleapis.com",
    "run.googleapis.com",
    "secretmanager.googleapis.com",
    "storage.googleapis.com"
  ])
  secret_names = toset([
    "help-review-database-url",
    "help-review-playback-secret",
    "help-review-session-secret",
    "help-review-upload-secret",
    "help-review-worker-secret"
  ])
  shared_environment = {
    NODE_ENV                              = "production"
    HELP_REVIEW_STATE_ADAPTER             = "neon"
    HELP_REVIEW_DATABASE_ADAPTER          = "neon"
    HELP_REVIEW_VIDEO_ADAPTER             = "gcs"
    HELP_REVIEW_PROCESSING_ADAPTER        = "gcs-event"
    HELP_REVIEW_SCORING_ADAPTER           = var.scoring_adapter
    HELP_REVIEW_IDENTITY_ADAPTER          = "sandbox"
    HELP_REVIEW_SANITIZED_PRODUCTION_ACK  = "true"
    HELP_REVIEW_REAL_DATA_ENABLED         = "false"
    HELP_REVIEW_SEED_SANITIZED_DATA       = "true"
    GCS_VIDEO_BUCKET                      = local.bucket_name
    GCS_PROCESSING_REQUEST_PREFIX         = "processing-requests/"
    GOOGLE_CLOUD_PROJECT                  = var.project_id
    VERTEX_AI_LOCATION                    = var.region
    VERTEX_AI_MODEL                       = var.vertex_model
    HELP_REVIEW_MAX_PROCESSING_DELIVERIES = "5"
  }
}

data "google_project" "current" {
  project_id = var.project_id
}

resource "google_project_service" "required" {
  for_each           = local.required_services
  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

resource "google_artifact_registry_repository" "containers" {
  project       = var.project_id
  location      = var.region
  repository_id = var.artifact_repository
  description   = "HELP Review web and processor images"
  format        = "DOCKER"

  depends_on = [google_project_service.required["artifactregistry.googleapis.com"]]
}

resource "google_storage_bucket" "video" {
  project                     = var.project_id
  name                        = local.bucket_name
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false

  cors {
    origin          = ["*"]
    method          = ["GET", "HEAD", "PUT"]
    response_header = ["Content-Length", "Content-Range", "Content-Type", "Range", "x-goog-resumable"]
    max_age_seconds = 3600
  }

  lifecycle_rule {
    condition {
      age            = 1
      matches_prefix = ["processing-requests/"]
    }
    action { type = "Delete" }
  }

  lifecycle_rule {
    condition {
      age            = var.video_retention_days
      matches_prefix = ["videos/"]
    }
    action { type = "Delete" }
  }

  depends_on = [google_project_service.required["storage.googleapis.com"]]
}

resource "google_service_account" "web" {
  project      = var.project_id
  account_id   = "help-review-web"
  display_name = "HELP Review web service"
}

resource "google_service_account" "processor" {
  project      = var.project_id
  account_id   = "help-review-processor"
  display_name = "HELP Review private processor"
}

resource "google_service_account" "eventarc" {
  project      = var.project_id
  account_id   = "help-review-eventarc"
  display_name = "HELP Review Eventarc delivery"
}

resource "google_storage_bucket_iam_member" "web_objects" {
  bucket = google_storage_bucket.video.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.web.email}"
}

resource "google_storage_bucket_iam_member" "processor_objects" {
  bucket = google_storage_bucket.video.name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.processor.email}"
}

resource "google_project_iam_member" "processor_vertex" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.processor.email}"
}

resource "google_project_iam_member" "eventarc_receiver" {
  project = var.project_id
  role    = "roles/eventarc.eventReceiver"
  member  = "serviceAccount:${google_service_account.eventarc.email}"
}

# Make the API-created Eventarc service agent role explicit so a first deploy
# does not race eventual IAM propagation while the trigger is created.
resource "google_project_iam_member" "eventarc_service_agent" {
  project = var.project_id
  role    = "roles/eventarc.serviceAgent"
  member  = "serviceAccount:service-${data.google_project.current.number}@gcp-sa-eventarc.iam.gserviceaccount.com"

  depends_on = [google_project_service.required["eventarc.googleapis.com"]]
}

resource "google_service_account_iam_member" "web_signer" {
  service_account_id = google_service_account.web.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:${google_service_account.web.email}"
}

data "google_storage_project_service_account" "gcs" {
  project    = var.project_id
  depends_on = [google_project_service.required["storage.googleapis.com"]]
}

resource "google_project_iam_member" "gcs_pubsub" {
  project = var.project_id
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${data.google_storage_project_service_account.gcs.email_address}"
}

resource "google_secret_manager_secret" "runtime" {
  for_each  = local.secret_names
  project   = var.project_id
  secret_id = each.value
  replication {
    auto {}
  }

  depends_on = [google_project_service.required["secretmanager.googleapis.com"]]
}

resource "google_secret_manager_secret_iam_member" "database_web" {
  secret_id = google_secret_manager_secret.runtime["help-review-database-url"].id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.web.email}"
}

resource "google_secret_manager_secret_iam_member" "database_processor" {
  secret_id = google_secret_manager_secret.runtime["help-review-database-url"].id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.processor.email}"
}

resource "google_secret_manager_secret_iam_member" "worker_web" {
  secret_id = google_secret_manager_secret.runtime["help-review-worker-secret"].id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.web.email}"
}

resource "google_secret_manager_secret_iam_member" "worker_processor" {
  secret_id = google_secret_manager_secret.runtime["help-review-worker-secret"].id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.processor.email}"
}

resource "google_secret_manager_secret_iam_member" "web_only" {
  for_each = toset([
    "help-review-playback-secret",
    "help-review-session-secret",
    "help-review-upload-secret"
  ])
  secret_id = google_secret_manager_secret.runtime[each.value].id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.web.email}"
}

resource "google_cloud_run_v2_service" "web" {
  count    = var.deploy_services ? 1 : 0
  project  = var.project_id
  name     = "help-review-web"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account                  = google_service_account.web.email
    timeout                          = "300s"
    max_instance_request_concurrency = 80
    scaling {
      min_instance_count = 0
      max_instance_count = 3
    }
    containers {
      image = var.web_image
      ports { container_port = 8080 }
      resources {
        limits            = { cpu = "1", memory = "1Gi" }
        cpu_idle          = true
        startup_cpu_boost = true
      }
      startup_probe {
        initial_delay_seconds = 5
        timeout_seconds       = 5
        period_seconds        = 10
        failure_threshold     = 12
        http_get { path = "/api/health" }
      }
      dynamic "env" {
        for_each = merge(local.shared_environment, { HELP_REVIEW_SERVICE_ROLE = "web" })
        content {
          name  = env.key
          value = env.value
        }
      }
      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.runtime["help-review-database-url"].secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "HELP_REVIEW_SESSION_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.runtime["help-review-session-secret"].secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "HELP_REVIEW_PLAYBACK_GRANT_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.runtime["help-review-playback-secret"].secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "HELP_REVIEW_UPLOAD_GRANT_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.runtime["help-review-upload-secret"].secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "HELP_REVIEW_WORKER_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.runtime["help-review-worker-secret"].secret_id
            version = "latest"
          }
        }
      }
    }
  }

  depends_on = [
    google_project_service.required["run.googleapis.com"],
    google_storage_bucket_iam_member.web_objects,
    google_secret_manager_secret_iam_member.database_web,
    google_secret_manager_secret_iam_member.web_only,
    google_secret_manager_secret_iam_member.worker_web
  ]
}

resource "google_cloud_run_v2_service" "processor" {
  count    = var.deploy_services ? 1 : 0
  project  = var.project_id
  name     = "help-review-processor"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_INTERNAL_ONLY"

  template {
    service_account                  = google_service_account.processor.email
    timeout                          = "900s"
    max_instance_request_concurrency = 1
    scaling {
      min_instance_count = 0
      max_instance_count = 3
    }
    containers {
      image = var.processor_image
      ports { container_port = 8080 }
      resources {
        limits            = { cpu = "2", memory = "2Gi" }
        cpu_idle          = true
        startup_cpu_boost = true
      }
      startup_probe {
        initial_delay_seconds = 2
        timeout_seconds       = 3
        period_seconds        = 5
        failure_threshold     = 12
        http_get { path = "/healthz" }
      }
      dynamic "env" {
        for_each = merge(local.shared_environment, { HELP_REVIEW_SERVICE_ROLE = "processor" })
        content {
          name  = env.key
          value = env.value
        }
      }
      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.runtime["help-review-database-url"].secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "HELP_REVIEW_WORKER_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.runtime["help-review-worker-secret"].secret_id
            version = "latest"
          }
        }
      }
    }
  }

  depends_on = [
    google_project_service.required["run.googleapis.com"],
    google_storage_bucket_iam_member.processor_objects,
    google_project_iam_member.processor_vertex,
    google_secret_manager_secret_iam_member.database_processor,
    google_secret_manager_secret_iam_member.worker_processor
  ]
}

resource "google_cloud_run_v2_service_iam_member" "web_public" {
  count    = var.deploy_services ? 1 : 0
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.web[0].name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service_iam_member" "eventarc_processor" {
  count    = var.deploy_services ? 1 : 0
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.processor[0].name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.eventarc.email}"
}

resource "google_eventarc_trigger" "processing" {
  count           = var.deploy_services ? 1 : 0
  project         = var.project_id
  name            = "help-review-processing-requests"
  location        = var.region
  service_account = google_service_account.eventarc.email

  matching_criteria {
    attribute = "type"
    value     = "google.cloud.storage.object.v1.finalized"
  }
  matching_criteria {
    attribute = "bucket"
    value     = google_storage_bucket.video.name
  }
  destination {
    cloud_run_service {
      service = google_cloud_run_v2_service.processor[0].name
      region  = var.region
      path    = "/events/storage"
    }
  }
  depends_on = [
    google_cloud_run_v2_service_iam_member.eventarc_processor,
    google_project_iam_member.eventarc_receiver,
    google_project_iam_member.eventarc_service_agent,
    google_project_iam_member.gcs_pubsub,
    google_project_service.required["eventarc.googleapis.com"]
  ]
}
