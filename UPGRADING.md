# Upgrading

## From < 0.1.0

* `filterPattern` used to default to `[timestamp=*Z, request_id=\"*-*\", event]`.
  However, this was an unreliable default because some runtimes report in
  different formats. See [issue #16](https://github.com/ACloudGuru/serverless-plugin-cloudwatch-sumologic/issues/16)
  for more information.

  To retain the prior behavior, you'll need to set the following `filterPattern`
  value in your `serverless.yml` file.

  ```yaml
    plugins:
      - serverless-plugin-cloudwatch-sumologic

    custom:
      shipLogs:
        filterPattern: "[timestamp=*Z, request_id=\"*-*\", event]"
  ```
