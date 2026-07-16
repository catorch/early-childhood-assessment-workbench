locals {
  bucket_name = var.video_bucket_name != "" ? var.video_bucket_name : "${var.project_id}-help-review-videos"
  required_services = toset([
    "aiplatform.googleapis.com",
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "eventarc.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "pubsub.googleapis.com",
    "run.googleapis.com",
    "secretmanager.googleapis.com",
    "storage.googleapis.com"
  ])
  alert_email = var.alert_email != "" ? var.alert_email : var.support_email
  secret_names = toset([
    "help-review-database-url",
    "help-review-playback-secret",
    "help-review-resend-api-key",
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
    HELP_REVIEW_HELP_CATALOG_PATH         = var.help_catalog_path
    HELP_REVIEW_HELP_CATALOG_VERSION      = var.help_catalog_version
    HELP_REVIEW_HELP_CATALOG_SHA256       = var.help_catalog_sha256
    HELP_REVIEW_IDENTITY_ADAPTER          = var.identity_adapter
    NEXT_PUBLIC_HELP_REVIEW_SUPPORT_EMAIL = var.support_email
    HELP_REVIEW_SANITIZED_PRODUCTION_ACK  = "true"
    HELP_REVIEW_REAL_DATA_ENABLED         = tostring(var.real_data_enabled)
    HELP_REVIEW_REAL_DATA_APPROVAL_ID     = var.real_data_approval_id
    HELP_REVIEW_SEED_SANITIZED_DATA       = tostring(!var.real_data_enabled)
    GCS_VIDEO_BUCKET                      = local.bucket_name
    GCS_PROCESSING_REQUEST_PREFIX         = "processing-requests/"
    GOOGLE_CLOUD_PROJECT                  = var.project_id
    VERTEX_AI_LOCATION                    = var.region
    VERTEX_AI_MODEL                       = var.vertex_model
    HELP_REVIEW_MAX_PROCESSING_DELIVERIES = "5"
  }
}

check "email_password_configuration" {
  assert {
    condition = var.identity_adapter != "email-password" || (
      length(trimspace(var.email_from)) > 0 && startswith(var.app_origin, "https://")
    )
    error_message = "Email/password sign-in requires email_from and an https app_origin for account setup links."
  }
}

check "real_data_configuration" {
  assert {
    condition = !var.real_data_enabled || (
      var.identity_adapter == "email-password" &&
      var.scoring_adapter == "vertex" &&
      var.help_catalog_version != "help-2-provisional-2026-07" &&
      length(var.help_catalog_sha256) == 64 &&
      length(trimspace(var.real_data_approval_id)) > 0
    )
    error_message = "Real data requires email/password sign-in, Vertex scoring, and a recorded approval ID."
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

resource "google_project_service" "observability" {
  for_each = toset([
    "logging.googleapis.com",
    "monitoring.googleapis.com"
  ])
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

resource "google_project_iam_member" "gcs_pubsub" {
  project = var.project_id
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:service-${data.google_project.current.number}@gs-project-accounts.iam.gserviceaccount.com"

  depends_on = [google_project_service.required["storage.googleapis.com"]]
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
    "help-review-resend-api-key",
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
      dynamic "env" {
        for_each = var.identity_adapter == "email-password" ? [1] : []
        content {
          name  = "HELP_REVIEW_EMAIL_ADAPTER"
          value = "resend"
        }
      }
      dynamic "env" {
        for_each = var.identity_adapter == "email-password" ? [1] : []
        content {
          name  = "HELP_REVIEW_EMAIL_FROM"
          value = var.email_from
        }
      }
      dynamic "env" {
        for_each = var.identity_adapter == "email-password" ? [1] : []
        content {
          name  = "HELP_REVIEW_APP_ORIGIN"
          value = var.app_origin
        }
      }
      dynamic "env" {
        for_each = var.identity_adapter == "email-password" ? [1] : []
        content {
          name = "RESEND_API_KEY"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.runtime["help-review-resend-api-key"].secret_id
              version = "latest"
            }
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

  lifecycle {
    ignore_changes = [client, client_version, template[0].revision]
  }
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


  lifecycle {
    ignore_changes = [client, client_version, template[0].revision]
  }
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

resource "google_logging_metric" "route_failures" {
  project     = var.project_id
  name        = "help_review_route_failures"
  description = "Count of redacted HELP Review route failures."
  filter      = "resource.type=\"cloud_run_revision\" AND jsonPayload.event=\"help_review_route_failure\""

  metric_descriptor {
    metric_kind  = "DELTA"
    value_type   = "INT64"
    unit         = "1"
    display_name = "HELP Review route failures"
  }

  depends_on = [google_project_service.observability["logging.googleapis.com"]]
}

resource "google_logging_metric" "processing_failures" {
  project     = var.project_id
  name        = "help_review_processing_failures"
  description = "Count of terminal HELP Review processing outcomes."
  filter      = "resource.type=\"cloud_run_revision\" AND jsonPayload.event=\"help_review_processing_outcome\" AND jsonPayload.outcome=\"FAILED\""

  metric_descriptor {
    metric_kind  = "DELTA"
    value_type   = "INT64"
    unit         = "1"
    display_name = "HELP Review processing failures"
  }

  depends_on = [google_project_service.observability["logging.googleapis.com"]]
}

resource "time_sleep" "logging_metric_propagation" {
  create_duration = "90s"
  triggers = {
    route_metric      = google_logging_metric.route_failures.id
    processing_metric = google_logging_metric.processing_failures.id
  }
}

resource "google_monitoring_notification_channel" "operations_email" {
  project      = var.project_id
  display_name = "HELP Review operations email"
  type         = "email"
  labels = {
    email_address = local.alert_email
  }

  depends_on = [google_project_service.observability["monitoring.googleapis.com"]]
}

resource "google_monitoring_alert_policy" "route_failures" {
  project               = var.project_id
  display_name          = "HELP Review repeated route failures"
  combiner              = "OR"
  enabled               = true
  notification_channels = [google_monitoring_notification_channel.operations_email.name]

  documentation {
    content   = "Five or more redacted route failures were recorded in five minutes. Use correlation IDs and the HELP Review incident runbook; do not copy request payloads or child data into the incident."
    mime_type = "text/markdown"
  }

  conditions {
    display_name = "Route failures exceed the pilot threshold"
    condition_threshold {
      comparison      = "COMPARISON_GT"
      duration        = "0s"
      filter          = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.route_failures.name}\" AND resource.type=\"cloud_run_revision\""
      threshold_value = var.route_failure_alert_threshold - 1
      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_SUM"
        cross_series_reducer = "REDUCE_SUM"
      }
      trigger { count = 1 }
    }
  }

  alert_strategy { auto_close = "1800s" }
  user_labels = {
    service  = "help-review"
    severity = "warning"
  }

  depends_on = [
    google_project_service.observability["monitoring.googleapis.com"],
    time_sleep.logging_metric_propagation
  ]
}

resource "google_monitoring_alert_policy" "processing_failures" {
  project               = var.project_id
  display_name          = "HELP Review terminal processing failure"
  combiner              = "OR"
  enabled               = true
  notification_channels = [google_monitoring_notification_channel.operations_email.name]

  documentation {
    content   = "A terminal processing attempt was recorded. Inspect only the safe run reference and error category in Admin Jobs, verify video availability and retry eligibility, then follow the processing incident procedure."
    mime_type = "text/markdown"
  }

  conditions {
    display_name = "Any terminal processing outcome"
    condition_threshold {
      comparison      = "COMPARISON_GT"
      duration        = "0s"
      filter          = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.processing_failures.name}\" AND resource.type=\"cloud_run_revision\""
      threshold_value = 0
      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_SUM"
        cross_series_reducer = "REDUCE_SUM"
      }
      trigger { count = 1 }
    }
  }

  alert_strategy { auto_close = "1800s" }
  user_labels = {
    service  = "help-review"
    severity = "error"
  }

  depends_on = [
    google_project_service.observability["monitoring.googleapis.com"],
    time_sleep.logging_metric_propagation
  ]
}

resource "google_monitoring_dashboard" "operations" {
  project = var.project_id
  dashboard_json = jsonencode({
    displayName = "HELP Review operations"
    gridLayout = {
      columns = 2
      widgets = [
        {
          title = "Route failures"
          xyChart = {
            dataSets = [{
              timeSeriesQuery = {
                timeSeriesFilter = {
                  filter = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.route_failures.name}\" AND resource.type=\"cloud_run_revision\""
                  aggregation = {
                    alignmentPeriod    = "300s"
                    perSeriesAligner   = "ALIGN_SUM"
                    crossSeriesReducer = "REDUCE_SUM"
                  }
                }
                unitOverride = "1"
              }
              plotType = "LINE"
            }]
            timeshiftDuration = "0s"
            yAxis = {
              label = "Failures"
              scale = "LINEAR"
            }
          }
        },
        {
          title = "Terminal processing failures"
          xyChart = {
            dataSets = [{
              timeSeriesQuery = {
                timeSeriesFilter = {
                  filter = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.processing_failures.name}\" AND resource.type=\"cloud_run_revision\""
                  aggregation = {
                    alignmentPeriod    = "60s"
                    perSeriesAligner   = "ALIGN_SUM"
                    crossSeriesReducer = "REDUCE_SUM"
                  }
                }
                unitOverride = "1"
              }
              plotType = "STACKED_BAR"
            }]
            timeshiftDuration = "0s"
            yAxis = {
              label = "Failures"
              scale = "LINEAR"
            }
          }
        }
      ]
    }
  })

  lifecycle {
    # Monitoring adds read-only name, etag, and chart defaults to dashboard_json.
    ignore_changes = [dashboard_json]
  }

  depends_on = [google_project_service.observability["monitoring.googleapis.com"]]
}
