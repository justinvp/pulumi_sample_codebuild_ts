import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

// Personal access token scopes: https://docs.aws.amazon.com/codebuild/latest/userguide/sample-access-tokens.html
const github_token = process.env.CI_GITHUB_TOKEN

// Specify repo.
const repo_url = "https://github.com/justinvp/pulumi_sample_codebuild_ts.git"

const provider = new aws.Provider("sample-aws-provider", { region: "us-west-2" });

// https://github.com/terraform-providers/terraform-provider-aws/issues/7435
const source_credentials = new aws.codebuild.SourceCredential("Github-Credentials", {
    authType: "PERSONAL_ACCESS_TOKEN",
    serverType: "GITHUB",
    token: github_token!,
}, {
    provider: provider,
    deleteBeforeReplace: true,
});

const cicd_role = new aws.iam.Role("CICD-sample-Role", {
    assumeRolePolicy: {
        "Version": "2012-10-17",
        "Statement": [
                {
                    "Effect": "Allow",
                    "Principal": {"Service": ["codebuild.amazonaws.com"]},
                    "Action": "sts:AssumeRole",
                }
        ],
    }
}, {
    provider: provider,
});

const cicd_policy = new aws.iam.RolePolicy("CICD-sample-policy", {
    policy: {
        "Version": "2012-10-17",
        "Statement": [
              {
                  "Effect": "Allow",
                  "Action": ["s3:GetBucketLocation", "s3:ListAllMyBuckets"],
                  "Resource": "arn:aws:s3:::*",
              },
            {"Effect": "Allow", "Action": "s3:*",
                  "Resource": ["*"], },
            {"Effect": "Allow", "Action": "lambda:*", "Resource": "*", },
            {"Effect": "Allow", "Action": "logs:*", "Resource": "*", },
        ],
    },
    role: cicd_role.name,
}, {
    provider: provider,
});

// Create a build project
const prebuild_project = new aws.codebuild.Project("sample", {
    name: "sample",
    buildTimeout: 30,
    artifacts: {
        "type": "NO_ARTIFACTS",
    },
    environment: {
        "computeType": "BUILD_GENERAL1_SMALL",
        "image": "aws/codebuild/amazonlinux2-x86_64-standard:3.0",
        "imagePullCredentialsType": "CODEBUILD",
        "type": "LINUX_CONTAINER",
        "privilegedMode": true,
    },
    serviceRole: cicd_role.arn,
    source: {
        "gitCloneDepth": 1,
        "gitSubmodulesConfig": {"fetchSubmodules": true, },
        "location": repo_url,
        "buildspec": "build.yml",
        "type": "GITHUB",
        "reportBuildStatus": true,
        "auths": [{"type": "OAUTH", "resource": source_credentials.arn, }],
    },
}, {
    provider: provider,
});
