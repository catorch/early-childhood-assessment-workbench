variable "project_id" {
  description = "Existing, billing-enabled Google Cloud project for HELP Review."
  type        = string
}

variable "region" {
  description = "Cloud Run, Eventarc, Artifact Registry, and Vertex AI region."
  type        = string
  default     = "us-central1"
}

variable "video_bucket_name" {
  description = "Globally unique private bucket name. Defaults to <project>-help-review-videos."
  type        = string
  default     = ""
}

variable "artifact_repository" {
  type    = string
  default = "help-review"
}

variable "deploy_services" {
  description = "Create Cloud Run services and Eventarc after images and secret versions exist."
  type        = bool
  default     = false
}

variable "web_image" {
  type    = string
  default = ""
}

variable "processor_image" {
  type    = string
  default = ""
}

variable "video_retention_days" {
  description = "Development object lifetime. Replace with the accepted organization retention policy before real data."
  type        = number
  default     = 30
}

variable "vertex_model" {
  type    = string
  default = "gemini-2.5-flash"
}

variable "scoring_adapter" {
  type    = string
  default = "vertex"

  validation {
    condition     = contains(["fake", "vertex"], var.scoring_adapter)
    error_message = "The GCP deployment supports fake or vertex scoring."
  }
}
