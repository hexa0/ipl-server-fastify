UBUNTU_VERSION=$(lsb_release -rs)

if grep -q "^UBUNTU_VERSION=" .env; then
  sed -i "s|^UBUNTU_VERSION=.*|UBUNTU_VERSION=${UBUNTU_VERSION}|" .env
else
  echo "UBUNTU_VERSION=${UBUNTU_VERSION}" >> .env
fi

docker compose up --build -d