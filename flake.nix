{
  description = "Development shell for Quartz (Bun + Node.js)";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      {
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            bun
            nodejs_22
          ];

          shellHook = ''
            echo "Dev shell ready (Bun: $(bun --version))"
            echo "Run: bun install"

            # Improve local dev log readability in Bun/Consola.
            unset NO_COLOR
            unset CI
            export FORCE_COLOR=1
            if [ "''${TERM:-}" = "dumb" ]; then
              export TERM=xterm-256color
            fi
          '';
        };
      });
}