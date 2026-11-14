# Tester May Cry

[![CI](https://github.com/Husain-Khamis/Tester-May-Cry/actions/workflows/ci.yml/badge.svg)](https://github.com/Husain-Khamis/Tester-May-Cry/actions/workflows/ci.yml)

*This party's getting crazy. Let's rock.*

A Devil May Cry 3–themed practice arena for [reboot01](https://learn.reboot01.com) checkpoints. Pick your path, clear missions, and get graded by the same official 01-edu graders the real exam uses.

| Path | Language |
|------|----------|
| Devil Hunter | Go |
| Son of Sparda | JavaScript |
| Dante Must Die | Rust |

## What awaits you

- **Missions:** every checkpoint exercise, grouped by level, with the subject, expected files, and Go's allowed functions.
- **Run:** executes your solution together with the subject's usage program, so you see real output.
- **Test:** grades your code with 01-edu's official grader. Clear it to earn a **Mission Clear**.
- **Style rank:** clear a mission on the first try for **SSS**. Every failed attempt before that drops you a rank, down to **D**.
- **Bloody Palace:** a 3-hour mock exam with one random mission per level.
- **Save slots:** three slots, autosaved as you type. Export a slot to a file to back it up or carry it to another machine.
- **No soft-locks:** any run that goes past a minute is stopped, and you can stop it yourself sooner.

## Requirements

- [Docker](https://docs.docker.com/get-docker/)

## Summon it

> The first run takes a moment while the image downloads.

```bash
docker run --name tester-may-cry -p 3000:3000 -v /var/run/docker.sock:/var/run/docker.sock ghcr.io/husain-khamis/tester-may-cry:latest
```

Then open `http://localhost:3000`.

To stop it:

```bash
docker stop tester-may-cry
```

To start it again later:

```bash
docker start tester-may-cry
```

## The graders

Submissions are graded by 01-edu's official grader Docker images (`ghcr.io/01-edu/*`). Each run gets no network, a read-only filesystem, 512MB `/jail` and 256MB `/tmp` scratch space, resource limits, and runs as uid 1000. The first test per language downloads that language's grader (~300–450MB).

- **Security:** mounting the Docker socket gives the app root on the host. Run it locally only and never expose it publicly.
- **If 01-edu hides the graders:** run `server/scripts/snapshot-images.sh` while they still exist. It saves them to `snapshots/`; restore with `docker load -i`.
- **Mirrors:** set `GRADER_IMAGE_<NAME>` (e.g. `GRADER_IMAGE_TEST_GO=ghcr.io/you/test-go`) to use your own copy of a grader.

## Updating

When a new version is released, remove the old container and image, then summon it again:

```bash
docker stop tester-may-cry
docker rm tester-may-cry
docker rmi ghcr.io/husain-khamis/tester-may-cry:latest
```

## Run it without Docker

Grading still needs Docker running on your machine, but the app itself can run straight from Node:

```bash
cd server && npm ci && npm run dev    # API on :3000
cd client && npm ci && npm run dev    # UI on :5173
```

---

Fan-made and unofficial. Not affiliated with or endorsed by Capcom. *Devil May Cry* is a trademark of Capcom.
