#!/bin/sh
set -eu
umask 077
ip_address=${1:-}
if [ -z "$ip_address" ] || ! node -e 'process.exit(require("node:net").isIP(process.argv[1]) === 4 ? 0 : 1)' "$ip_address"; then
  echo '用法：sh scripts/generate-lan-cert.sh <局域网 IPv4>' >&2
  exit 1
fi
cert_dir=$(mktemp -d /private/tmp/asset-pwa-cert.XXXXXX)
cat > "$cert_dir/ca.cnf" <<'CONFIG'
[req]
distinguished_name=dn
x509_extensions=v3_ca
prompt=no
[dn]
CN=Asset Cost Local Test CA
[v3_ca]
basicConstraints=critical,CA:TRUE
keyUsage=critical,keyCertSign,cRLSign
subjectKeyIdentifier=hash
CONFIG
cat > "$cert_dir/server.cnf" <<CONFIG
[req]
distinguished_name=dn
req_extensions=v3_req
prompt=no
[dn]
CN=$ip_address
[v3_req]
subjectAltName=IP:$ip_address
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
basicConstraints=critical,CA:FALSE
CONFIG
openssl req -x509 -newkey rsa:2048 -noenc -days 30 -config "$cert_dir/ca.cnf" -keyout "$cert_dir/ca.key" -out "$cert_dir/ca.crt" >/dev/null 2>&1
openssl req -newkey rsa:2048 -noenc -config "$cert_dir/server.cnf" -keyout "$cert_dir/server.key" -out "$cert_dir/server.csr" >/dev/null 2>&1
openssl x509 -req -in "$cert_dir/server.csr" -CA "$cert_dir/ca.crt" -CAkey "$cert_dir/ca.key" -CAcreateserial -days 30 -extfile "$cert_dir/server.cnf" -extensions v3_req -out "$cert_dir/server.crt" >/dev/null 2>&1
openssl verify -CAfile "$cert_dir/ca.crt" "$cert_dir/server.crt"
printf '证书目录：%s\n手机只需安装 CA 证书：%s/ca.crt\n启动服务所需：%s/server.crt %s/server.key\n私钥只保留在本机，不要发送到手机。\n' "$cert_dir" "$cert_dir" "$cert_dir" "$cert_dir"
