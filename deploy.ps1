param(
    [Parameter(Mandatory=$true)] [string]$VmIp,
    [string]$SshKey = "$env:USERPROFILE\.ssh\oracle_rsa",
    [string]$SshUser = "ubuntu"
)

Write-Host "==> DNS Firewall Deploy to $VmIp" -ForegroundColor Cyan

$sshArgs = "-i `"$SshKey`" -o StrictHostKeyChecking=no"

ssh $sshArgs "$SshUser@$VmIp" "mkdir -p ~/dns-firewall"

scp $sshArgs docker-compose.yml "$SshUser@$VmIp`:~/dns-firewall/"
scp $sshArgs Dockerfile "$SshUser@$VmIp`:~/dns-firewall/"

ssh $sshArgs "$SshUser@$VmIp" "mkdir -p ~/dns-firewall/backend ~/dns-firewall/frontend"

Compress-Archive -Path "backend/*" -DestinationPath "$env:TEMP\backend.zip" -Force
Compress-Archive -Path "frontend/*" -DestinationPath "$env:TEMP\frontend.zip" -Force

scp $sshArgs "$env:TEMP\backend.zip" "$SshUser@$VmIp`:~/dns-firewall/backend/"
scp $sshArgs "$env:TEMP\frontend.zip" "$SshUser@$VmIp`:~/dns-firewall/frontend/"

Remove-Item "$env:TEMP\backend.zip", "$env:TEMP\frontend.zip" -Force

Write-Host "==> Setting up on VM..." -ForegroundColor Cyan
ssh $sshArgs "$SshUser@$VmIp" @"

set -euo pipefail

cd ~/dns-firewall

unzip -o backend/backend.zip -d backend/
unzip -o frontend/frontend.zip -d frontend/
rm backend/backend.zip frontend/frontend.zip

if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker ubuntu
fi

docker compose build --pull
docker compose up -d
docker compose ps

sudo iptables -I INPUT -p udp --dport 53 -j ACCEPT 2>/dev/null || true
sudo iptables -I INPUT -p tcp --dport 53 -j ACCEPT 2>/dev/null || true
sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null || true
sudo apt-get install -y iptables-persistent 2>/dev/null || true
sudo netfilter-persistent save 2>/dev/null || true

echo ""
echo "=== Done! ==="
echo "Dashboard: http://$VmIp"
echo "DNS server: $VmIp"
"@

Write-Host "==> Deploy complete!" -ForegroundColor Green
Write-Host "Dashboard: http://$VmIp" -ForegroundColor Yellow
