output "video_bucket" {
  value = google_storage_bucket.video.name
}

output "artifact_repository" {
  value = google_artifact_registry_repository.containers.name
}

output "web_service_url" {
  value = var.deploy_services ? google_cloud_run_v2_service.web[0].uri : null
}

output "processor_service_name" {
  value = var.deploy_services ? google_cloud_run_v2_service.processor[0].name : null
}

output "eventarc_trigger" {
  value = var.deploy_services ? google_eventarc_trigger.processing[0].name : null
}
