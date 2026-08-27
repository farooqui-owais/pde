**how to use psql in docker exec to check database table container

Thinking

I'll demonstrate how to use `psql` inside the running database container to inspect the tables.

Cline wants to execute this command:

Completed

```shell
docker compose exec db psql -U postgres -d pde -c "\dt"
```

```shell
time="2026-08-22T12:16:11+05:30" level=warning msg="C:\\Users\\Home\\Desktop\\pde\\docker-compose.yml: the attribute `version` is obsolete, it will be ignored, please remove it to avoid potential confusion"
                List of relations
 Schema |         Name         | Type  |  Owner
--------+----------------------+-------+----------
 public | article_types        | table | postgres
 public | districts            | table | postgres
 public | document_entries     | table | postgres
 public | entry_tokens         | table | postgres
 public | registration_offices | table | postgres
 public | users                | table | postgres
(6 rows)

:\WINDOWS\System32\WindowsPowerShell\v1.0\powershell.exe\
```

The command worked and shows 6 tables in the `pde` database. Let me also show how to inspect the schema of a specific table and query its data.

Cline wants to execute this command:

Running

```shell
docker compose exec db psql -U postgres -d pde -c "\d users"
```

```shell
time="2026-08-22T12:16:18+05:30" level=warning msg="C:\\Users\\Home\\Desktop\\pde\\docker-compose.yml: the attribute `version` is obsolete, it will be ignored, please remove it to avoid potential confusion"
                                Table "public.users"
        Column        |            Type             | Collation | Nullable | Default
----------------------+-----------------------------+-----------+----------+---------
 id                   | uuid                        |           | not null |
 title                | character varying(10)       |           |          |
 first_name           | character varying(80)       |           | not null |
 middle_name          | character varying(80)       |           |          |
 last_name            | character varying(80)       |           |          |
 username             | character varying(60)       |           | not null |
 hashed_password      | character varying(255)      |           | not null |
 mobile_number        | character varying(15)       |           | not null |
 landline_number      | character varying(20)       |           |          |
```

**Access to XMLHttpRequest at 'http://localhost:8000/api/auth/register' from origin 'http://localhost:5173' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource. after running docker -compose up

Thinking

The CORS error means the backend isn't allowing requests from `http://localhost:5173`. Let me check the backend's CORS configuration.

Cline read 1 file:

pde-backend/app/main.py · lines 1-27‎

The CORS config looks correct — it allows `http://localhost:5173`. The error suggests either the running container has stale code, or the frontend is being served from a different origin (like `127.0.0.1:5173`). Let me check the frontend configuration.

Cline read 1 file:

pde-frontend/vite.config.js · lines 1-9‎

The frontend is on port 5173 and the backend allows `http://localhost:5173`. The issue is likely that the user is accessing via `http://127.0.0.1:5173` (different origin) or the running container has stale code. Let me check the frontend's API configuration.

Cline read 2 files, 1 folder:

pde-frontend/src‎

pde-frontend/src/‎

pde-frontend/src/api/axios.js · lines 1-29‎

The configuration looks correct. The most likely cause is that the browser is accessing the frontend via `http://127.0.0.1:5173` instead of `http://localhost:5173` — these are different origins for CORS purposes, and `127.0.0.1` isn't in the allow list. There could also be stale container code. Let me verify what's currently running.

Cline wants to execute this command:

Completed

```shell
docker compose exec backend python -c "from app.main import app; print([m for m in app.user_middleware])"
```

```shell
time="2026-08-23T16:04:50+05:30" level=warning msg="C:\\Users\\Home\\Desktop\\pde\\docker-compose.yml: the attribute `version` is obsolete, it will be ignored, please remove it to avoid potential confusion"
[Middleware(CORSMiddleware, allow_origins=['http://localhost:5173', 'http://localhost:3000'], allow_credentials=True, allow_methods=['*'], allow_headers=['*'])]
:\WINDOWS\System32\WindowsPowerShell\v1.0\powershell.exe\
```

```shell
docker compose up --build -d backend
```


curl.exe -i -X OPTIONS http://localhost:8000/api/auth/register -H "Origin: http://localhost:5173" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: content-type"
```

