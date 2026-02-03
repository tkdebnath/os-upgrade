# Upgrade API

Trigger upgrades from scripts, Ansible, or whatever.

## Auth

Need a token. Get one from Django admin or:

```bash
curl -X POST http://swim.example.com/api/auth/login/ \
  -d "username=admin&password=yourpass"
```

Use token in headers:
```bash
Authorization: Token YOUR_TOKEN_HERE
```

## Trigger Upgrade

`POST /api/upgrade/trigger/`

**Simple upgrade (auto-selects golden image):**
```bash
curl -X POST https://swim.example.com/api/upgrade/trigger/ \
  -H "Authorization: Token YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "devices": ["sw1", "sw2", "sw3"],
    "auto_select_image": true
  }'
```

**Specific image:**
```bash
curl -X POST https://swim.example.com/api/upgrade/trigger/ \
  -H "Authorization: Token YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "devices": [1, 2, 3],
    "image_id": 5
  }'
```

**Sequential (one at a time):**
```bash
curl -X POST https://swim.example.com/api/upgrade/trigger/ \
  -H "Authorization: Token YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "devices": [1, 2, 3],
    "execution_mode": "sequential",
    "auto_select_image": true
  }'
```

**Scheduled:**
```bash
curl -X POST https://swim.example.com/api/upgrade/trigger/ \
  -H "Authorization: Token YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "devices": [10, 11, 12],
    "schedule_time": "2026-02-03T02:00:00Z",
    "auto_select_image": true
  }'
```

**Options:**

| Field | Type | What it does |
|-------|------|--------------|
| `devices` | array | Device IDs or hostnames (required) |
| `image_id` | int | Specific image (optional, overrides golden) |
| `workflow_id` | int | Custom workflow (optional) |
| `execution_mode` | string | `parallel` or `sequential` (default: parallel) |
| `schedule_time` | string | ISO 8601 datetime for later (optional) |
| `activate_after_distribute` | bool | Auto-activate after copy (default: true) |
| `cleanup_flash` | bool | Clean flash first (default: false) |
| `auto_select_image` | bool | Use golden image (default: true) |

**Response:**
```json
{
  "status": "success",
  "jobs_created": 3,
  "job_ids": [101, 102, 103],
  "execution_mode": "parallel",
  "batch_id": "550e8400-e29b-41d4-a716-446655440000",
  "details": [
    {
      "device_id": 1,
      "device_hostname": "sw1",
      "job_id": 101,
      "image": "cat9k-universalk9.17.09.04a.SPA.bin",
      "status": "pending"
    }
  ]
}
```

## Check Status

`GET /api/upgrade/status/`

**By job IDs:**
```bash
curl -X GET "https://swim.example.com/api/upgrade/status/?job_ids=101,102,103" \
  -H "Authorization: Token YOUR_TOKEN"
```

**By batch:**
```bash
curl -X GET "https://swim.example.com/api/upgrade/status/?batch_id=550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Token YOUR_TOKEN"
```

**Response:**
```json
{
  "count": 3,
  "jobs": [
    {
      "id": 101,
      "device_hostname": "sw1",
      "status": "activating",
      "progress": 75,
      "current_step": "Activation",
      "image_filename": "cat9k-universalk9.17.09.04a.SPA.bin",
      "steps": [
        {"name": "Readiness Check", "status": "success"},
        {"name": "Distribution", "status": "success"},
        {"name": "Activation", "status": "running"},
        {"name": "Post-Checks", "status": "pending"}
      ]
    }
  ]
}
```

**Status values:**
- `pending` - Queued
- `scheduled` - Waiting for schedule time
- `distributing` - Copying image
- `activating` - Installing
- `success` - Done
- `failed` - Error
- `cancelled` - User cancelled

## Cancel Jobs

`POST /api/upgrade/cancel/`

```bash
curl -X POST https://swim.example.com/api/upgrade/cancel/ \
  -H "Authorization: Token YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"job_ids": [101, 102, 103]}'
```

**Response:**
```json
{
  "status": "success",
  "cancelled": 3,
  "job_ids": [101, 102, 103]
}
```

Only works on `pending` or `scheduled` jobs. Can't cancel running upgrades.

## Python Example

```python
import requests

API_URL = "https://swim.example.com/api"
TOKEN = "your_token_here"
headers = {"Authorization": f"Token {TOKEN}"}

# Trigger upgrade
response = requests.post(
    f"{API_URL}/upgrade/trigger/",
    headers=headers,
    json={
        "devices": ["sw1", "sw2"],
        "auto_select_image": True,
        "execution_mode": "parallel"
    }
)
result = response.json()
job_ids = result["job_ids"]
print(f"Started jobs: {job_ids}")

# Check status
import time
while True:
    response = requests.get(
        f"{API_URL}/upgrade/status/",
        headers=headers,
        params={"job_ids": ",".join(map(str, job_ids))}
    )
    jobs = response.json()["jobs"]
    
    for job in jobs:
        print(f"{job['device_hostname']}: {job['status']} ({job['progress']}%)")
    
    if all(j["status"] in ["success", "failed"] for j in jobs):
        break
    
    time.sleep(30)
```
