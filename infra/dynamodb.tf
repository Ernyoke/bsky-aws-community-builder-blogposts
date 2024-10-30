locals {
  table_name = "bsky-aws-community-builder-blogposts"
}

resource "aws_dynamodb_table" "table" {
  name           = local.table_name
  billing_mode   = "PROVISIONED"
  read_capacity  = 10
  write_capacity = 10
  hash_key       = "ArticleId"

  attribute {
    name = "ArticleId"
    type = "N"
  }

  ttl {
    attribute_name = "TimeToExist"
    enabled        = true
  }
}