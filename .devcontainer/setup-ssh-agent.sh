#!/usr/bin/env bash
set -euo pipefail

HOST_SSH_DIR="/tmp/windows-ssh"
USER_SSH_DIR="${HOME}/.ssh"
AGENT_SOCK="/tmp/ssh-agent.sock"

if [ ! -d "${HOST_SSH_DIR}" ]; then
  exit 0
fi

mkdir -p "${USER_SSH_DIR}"
chmod 700 "${USER_SSH_DIR}"

shopt -s nullglob
for source_file in "${HOST_SSH_DIR}"/*; do
  if [ -f "${source_file}" ]; then
    file_name="$(basename "${source_file}")"
    cp -f "${source_file}" "${USER_SSH_DIR}/${file_name}" || true
  fi
done

for ssh_file in "${USER_SSH_DIR}"/*; do
  if [ -f "${ssh_file}" ]; then
    chmod 600 "${ssh_file}" || true
  fi
done

for public_key_file in "${USER_SSH_DIR}"/*.pub; do
  if [ -f "${public_key_file}" ]; then
    chmod 644 "${public_key_file}" || true
  fi
done

for metadata_file in "${USER_SSH_DIR}"/config "${USER_SSH_DIR}"/known_hosts "${USER_SSH_DIR}"/known_hosts2; do
  if [ -f "${metadata_file}" ]; then
    chmod 644 "${metadata_file}" || true
  fi
done

pkill -u "$(id -u)" ssh-agent >/dev/null 2>&1 || true
rm -f "${AGENT_SOCK}" || true

eval "$(ssh-agent -a "${AGENT_SOCK}" -s)" >/dev/null

for candidate_file in "${USER_SSH_DIR}"/*; do
  if [ ! -f "${candidate_file}" ]; then
    continue
  fi

  case "$(basename "${candidate_file}")" in
    *.pub|config|known_hosts|known_hosts2|known_hosts.old|authorized_keys)
      continue
      ;;
  esac

  if [ -r "${candidate_file}" ]; then
    ssh-add "${candidate_file}" >/dev/null 2>&1 || true
  fi
done
