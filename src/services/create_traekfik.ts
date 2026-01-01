const fs = require("fs");

function criarServico(username: string, nomeApp: string) {
  const compose = `
services:
  ${nomeApp}:
    build: ~/deploy/${username}/${nomeApp}
    container_name: ${nomeApp}_container
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.${nomeApp}.rule=Host(\`${nomeApp}.enor.tech\`)"
      - "traefik.http.routers.${nomeApp}.entrypoints=websecure"
      - "traefik.http.routers.${nomeApp}.tls.certresolver=myresolver"
    networks:
      - web

networks:
  web:
    external: true
`;
  fs.writeFileSync(`~/deploy/apps/${nomeApp}.yml`, compose);
}
