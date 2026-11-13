#!/usr/bin/env bash
# Retired: v48 has no client outbox producer or durable cloud consumer.
# Do not acknowledge messages before an Agent has durably accepted them.
echo "link-poll is retired. Use the Muse conversation and journaled ssh-call.sh." >&2
exit 2
