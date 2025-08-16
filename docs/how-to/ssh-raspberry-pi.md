# SSH into Raspberry Pi 5

## Quick Connect

Load environment variables and connect:
```bash
source .env
sshpass -p "$RASPI_PASSWORD" ssh "$RASPI_USER@$RASPI_HOST"
```

## Manual Connect

If you prefer to enter password manually:
```bash
ssh <username>@<pi_ip_address>
```
Enter password when prompted.

## Device Information

- **Architecture**: aarch64 (ARM64)
- **OS**: Linux kernel 6.12.25
- Device-specific details stored in `.env`

## Environment Variables

SSH credentials are stored in `.env` (not committed to git):
```bash
RASPI_HOST=<pi_ip_address>
RASPI_USER=<username>
RASPI_PASSWORD=<password>
RASPI_HOSTNAME=<hostname>
```

## Prerequisites

Install sshpass for automated authentication:
```bash
sudo apt-get install sshpass
```

## Run Commands Remotely

Execute single commands without interactive session:
```bash
source .env
sshpass -p "$RASPI_PASSWORD" ssh "$RASPI_USER@$RASPI_HOST" 'command_here'
```

## Troubleshooting

1. **Connection timeout**: Check if Pi is powered on and connected to network
2. **Permission denied**: Verify username/password in `.env`
3. **Host key verification failed**: Remove old key with `ssh-keygen -R <pi_ip_address>`