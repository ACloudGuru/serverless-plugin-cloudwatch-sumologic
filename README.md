# serverless-plugin-cloudwatch-sumologic [![Build Status](https://travis-ci.org/ACloudGuru/serverless-plugin-cloudwatch-sumologic.svg?branch=master)](https://travis-ci.org/ACloudGuru/serverless-plugin-cloudwatch-sumologic)
Plugin which auto-subscribes a log delivery lambda function to lambda log groups created by Serverless

# Installation
`npm install --save-dev serverless-plugin-cloudwatch-sumologic`

# Configuration
1. First follow [this guide](https://help.sumologic.com/Send_Data/Sources/HTTP_Source) to create a new collector and http source on Sumologic.
2. Add the following custom variables to your `serverless.yml` file.

```yaml
custom:
    shipLogs:
        # Required
        arn: existing cloudwatch logs ARN
        # OR
        collectorUrl: Paste your url from step 1. here

        # Optional, default pattern is "[timestamp=*Z, request_id=\"*-*\", event]"
        filterPattern: "[timestamp=*Z, request_id=\"*-*\", correlation_id=\"*-*\", event]"
        # Optional
        function:
            # Can override any handler paramters
```

# How it works
This plugin automates the process described in the [readme](https://github.com/SumoLogic/sumologic-aws-lambda/tree/master/cloudwatchlogs/README.md) provided by Sumologic.

Upon running `sls deploy` it will...

1. if no existing cloudwatch function is specified
    1. Create a temporary function in the root of your serverless project
    2. Add that function to the in-memory CloudFormation script created by the serverless framework
3. Iterate through all the functions (except for the sumologic one) and generate:
    1. CloudFormation Subscription Filter resources linking the log groups created by serverless framework to the sumologic lambda function.
4. Wait for the stack creation/update to complete and then delete the temporarily created function source directory.

# Caveats
You must be running serverless 1.6.0 or higher.

# Contribute
Please fork this repo to make changes and then issue a pull request back to this repo.
No unit tests are included at this time. Unit tests will be added before this goes into version 1.0.0

# Contributors
[Daniel Parker (@rlgod)](https://github.com/rlgod)
