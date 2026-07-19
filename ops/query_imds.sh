#!/usr/bin/env bash
# Query EC2 instance metadata for security groups and MAC addresses.
TOKEN=$(curl -s -X PUT -H "X-aws-ec2-metadata-token-ttl-seconds: 60" http://169.254.169.254/latest/api/token)
HDR="X-aws-ec2-metadata-token: $TOKEN"
BASE="http://169.254.169.254/latest/meta-data"

echo "=== Security groups ==="
curl -s -H "$HDR" "$BASE/security-groups"
echo

echo "=== MACs ==="
curl -s -H "$HDR" "$BASE/network/interfaces/macs/"
echo

for mac in $(curl -s -H "$HDR" "$BASE/network/interfaces/macs/" | tr -d '/'); do
  echo "=== security-group-ids for $mac ==="
  curl -s -H "$HDR" "$BASE/network/interfaces/macs/$mac/security-group-ids"
  echo
  echo "=== subnet-id for $mac ==="
  curl -s -H "$HDR" "$BASE/network/interfaces/macs/$mac/subnet-id"
  echo
done
