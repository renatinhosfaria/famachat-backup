{pkgs}: {
  deps = [
    pkgs.redis
    pkgs.docker
    pkgs.jq
    pkgs.unzip
    pkgs.zip
    pkgs.postgresql
  ];
}
