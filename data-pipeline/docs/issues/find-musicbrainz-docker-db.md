# Finding MusicBrainz Docker Database Connection Info

## Check Docker Containers
```bash
# List all running containers
docker ps

# Or with docker-compose
docker-compose ps
```

## Find Database Configuration

### Option 1: Check docker-compose.yaml
```bash
cd musicbrainz-server
cat docker-compose.yaml | grep -A 10 -B 5 postgres
```

Look for:
- Database service name (usually `db` or `postgres`)
- POSTGRES_DB
- POSTGRES_USER
- POSTGRES_PASSWORD
- Port mapping (usually 5432)

### Option 2: Check Environment Variables
```bash
# If using docker-compose
docker-compose config | grep -i postgres

# Or check .env file
cat .env | grep -i postgres
```

### Option 3: Inspect Running Container
```bash
# Find the postgres container
docker ps | grep postgres

# Inspect it (replace CONTAINER_ID)
docker inspect CONTAINER_ID | grep -E "POSTGRES_|5432"
```

### Option 4: Connect from Inside Docker Network
```bash
# Get into any container in the same network
docker exec -it musicbrainz-server_musicbrainz_1 bash

# Inside container, the DB host is usually the service name from docker-compose
# e.g., "db" or "postgres" not "localhost"
```

## Typical Docker Setup
```yaml
# Common docker-compose setup
services:
  db:
    image: postgres:12
    environment:
      POSTGRES_DB: musicbrainz_db
      POSTGRES_USER: musicbrainz
      POSTGRES_PASSWORD: musicbrainz
    ports:
      - "5432:5432"  # If exposed externally

  musicbrainz:
    depends_on:
      - db
    environment:
      MUSICBRAINZ_DB_HOST: db  # <-- Uses docker service name
```

## Test Connection
```bash
# From host machine (if port is exposed)
psql -h localhost -p 5432 -U musicbrainz -d musicbrainz_db

# Or use docker exec
docker exec -it <postgres_container> psql -U musicbrainz -d musicbrainz_db

# Quick test query
SELECT COUNT(*) FROM release_group WHERE type = 1;
```

## Common Values
- Host: `localhost` (from host) or `db` (from within docker network)
- Port: `5432`
- Database: `musicbrainz_db`
- User: `musicbrainz`
- Password: Check docker-compose.yaml or .env file