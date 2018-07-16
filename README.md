# serverless-plugin-cloudwatch-sumologic [![Build Status](https://travis-ci.org/ACloudGuru/serverless-plugin-cloudwatch-sumologic.svg?branch=master)](https://travis-ci.org/ACloudGuru/serverless-plugin-cloudwatch-sumologic)
Plugin which auto-subscribes a log delivery lambda function to lambda log groups created by Serverless

# Installation
`npm install --save-dev serverless-plugin-cloudwatch-sumologic`

# Configuration
1. First follow [this guide](https://help.sumologic.com/Send_Data/Sources/HTTP_Source) to create a new collector and http source on Sumologic.
2. Add the following custom variables to your `serverless.yml` file.

```yaml
plugins:
  - serverless-plugin-cloudwatch-sumologic

custom:
    shipLogs:
        # Required
        arn: existing cloudwatch logs ARN
        # OR
        collectorUrl: Paste your url from step 1. here

        # Optional, default pattern is "[timestamp=*Z, request_id=\"*-*\", event]"
        # NOTE: Some runtimes report a log level as the first parameter, so the
        #       default will not report any of your logs. You'll need to define
        #       a `filterPattern` that matches the behavior of your runtime.
        #
        #       Most of the time, you can add `log_level` as the first parameter.
        #       (e.g. "[log_level, timestamp = *Z, request_id, event]")
        #
        #       If you want to report everything, specify `filterPattern` as
        #       an empty string ("").
        #
        #       See https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/FilterAndPatternSyntax.html
        #       for more detailed information.
        filterPattern: "[timestamp=*Z, request_id=\"*-*\", correlation_id=\"*-*\", event]"
        role: ARN of IAM role to use
```

# How it works
This plugin automates the process described in the [readme](https://github.com/SumoLogic/sumologic-aws-lambda/tree/master/cloudwatchlogs/README.md) provided by Sumologic.

Upon running `sls deploy` it will...

1. if no existing cloudwatch function is specified
    1. Create a temporary function in the root of your serverless project
    2. Add that function to the in-memory CloudFormation script created by the serverless framework
2. Iterate through all the functions (except for the sumologic one) and generate:
    1. CloudFormation Subscription Filter Resource linking the log groups created by serverless framework to the sumologic lambda function.
    2. Permissions to Invoke the logging function, as a Resource.
3. Wait for the stack creation/update to complete and then delete the temporarily created function source directory.

# Caveats
You must be running serverless 1.25.0 or higher.

# Contribute
Please fork this repo to make changes and then issue a pull request back to this repo.
No unit tests are included at this time. Unit tests will be added before this goes into version 1.0.0

# Testing
Tests are written using Mocha, Sinon, Chai, using Rewire

Run with `npm test`

# Contributors
[Daniel Parker (@rlgod)](https://github.com/rlgod)
