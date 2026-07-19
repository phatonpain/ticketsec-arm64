import json
import boto3

SG_ID = "sg-0293de1eace5d362c"

def main():
    ec2 = boto3.client("ec2", region_name="us-east-2")
    resp = ec2.describe_security_groups(GroupIds=[SG_ID])
    groups = resp.get("SecurityGroups", [])
    if not groups:
        print("Security group not found")
        return 1
    sg = groups[0]
    out = {
        "group_id": sg["GroupId"],
        "group_name": sg["GroupName"],
        "vpc_id": sg.get("VpcId"),
        "ingress": sg.get("IpPermissions", []),
        "egress": sg.get("IpPermissionsEgress", []),
    }
    print(json.dumps(out, indent=2, default=str))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
