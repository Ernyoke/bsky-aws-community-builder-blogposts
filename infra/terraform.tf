terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0.0"
    }
  }

  backend "s3" {
    bucket = "bsky-tf-backend"
    key    = "bsky-aws-community-builder-blogposts"
    region = "us-east-1"
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = { "project" : "bsky-aws-community-builder-blogposts"
      "managedBy" : "Terraform"
    }
  }
}