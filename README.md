# CloudFolio

A serverless stock portfolio tracker built on AWS.

## Stack

- **Frontend**: Static HTML/CSS/JS (S3 or local)
- **Backend**: AWS Lambda (Python 3.12)
- **Database**: DynamoDB
- **API**: API Gateway (REST)
- **Infra**: CloudFormation
- **CI/CD**: GitHub Actions

## Setup

### 1. Deploy infrastructure

```bash
aws cloudformation deploy \
  --template-file infrastructure/cloudformation.yaml \
  --stack-name cloudfolio \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides AlphaVantageKey=YOUR_KEY
```

### 2. Wire up the frontend

Copy the `ApiUrl` output from the CloudFormation stack and paste it into `frontend/app.js`:

```js
const API_BASE = "https://xxxx.execute-api.us-east-1.amazonaws.com/prod";
```

### 3. CI/CD (GitHub Actions)

Add these secrets to your repo:

| Secret | Description |
|---|---|
| `AWS_ACCESS_KEY_ID` | IAM user key |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret |
| `DEPLOY_BUCKET` | S3 bucket for Lambda zips |
| `ALPHA_VANTAGE_KEY` | Alpha Vantage API key |

Push to `main` to trigger a deploy.

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/portfolio` | List all holdings with prices |
| POST | `/holding` | Add a holding |
| DELETE | `/holding/{id}` | Remove a holding |
