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

variable "help_catalog_path" {
  description = "Path inside the application image to the immutable HELP catalogue JSON artifact."
  type        = string
  default     = "content/help-catalog.sanitized.json"

  validation {
    condition     = length(trimspace(var.help_catalog_path)) > 0
    error_message = "help_catalog_path must identify the catalogue artifact included in the image."
  }
}

variable "help_catalog_version" {
  description = "Immutable catalogue version that must match the JSON artifact."
  type        = string
  default     = "help-2-provisional-2026-07"

  validation {
    condition     = length(trimspace(var.help_catalog_version)) > 0
    error_message = "help_catalog_version must not be empty."
  }
}

variable "help_catalog_sha256" {
  description = "Accepted lowercase SHA-256 digest of the exact catalogue artifact."
  type        = string
  default     = "7d604579d6c8f8fdf5ac0f3d0ef0643a1d4479806d6d6be38cb1bc2f92c451d2"

  validation {
    condition     = can(regex("^[a-f0-9]{64}$", var.help_catalog_sha256))
    error_message = "help_catalog_sha256 must be a 64-character lowercase SHA-256 digest."
  }
}

variable "identity_adapter" {
  description = "Exactly one application identity path. Use sandbox only for sanitized development."
  type        = string
  default     = "sandbox"

  validation {
    condition     = contains(["sandbox", "email-password"], var.identity_adapter)
    error_message = "identity_adapter must be sandbox or email-password."
  }
}

variable "email_from" {
  description = "Deliverable sender address for first-party invitation and password-reset emails."
  type        = string
  default     = ""
}

variable "app_origin" {
  description = "Public https origin used in account setup links, such as https://review.example.org."
  type        = string
  default     = ""
}

variable "real_data_enabled" {
  description = "Enables the fail-closed real-data runtime only after exact-build acceptance."
  type        = bool
  default     = false
}

variable "real_data_approval_id" {
  description = "Dated decision/acceptance record required when real_data_enabled is true."
  type        = string
  default     = ""
}

variable "support_email" {
  description = "Organization-owned support address embedded in the web UI."
  type        = string

  validation {
    condition     = can(regex("^[^@[:space:]]+@[^@[:space:]]+$", var.support_email))
    error_message = "support_email must be an organization-owned email address."
  }
}

variable "alert_email" {
  description = "Operations notification address. Defaults to support_email when empty."
  type        = string
  default     = ""

  validation {
    condition     = var.alert_email == "" || can(regex("^[^@[:space:]]+@[^@[:space:]]+$", var.alert_email))
    error_message = "alert_email must be empty or a deliverable organization-owned email address."
  }
}

variable "route_failure_alert_threshold" {
  description = "Number of redacted route failures in five minutes that opens an incident. Tune from staging evidence."
  type        = number
  default     = 5

  validation {
    condition     = var.route_failure_alert_threshold >= 1 && floor(var.route_failure_alert_threshold) == var.route_failure_alert_threshold
    error_message = "route_failure_alert_threshold must be a positive integer."
  }
}
