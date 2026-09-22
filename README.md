# FTP Transfer Action

[![GitHub Release](https://img.shields.io/github/v/release/joutvhu/ftp-transfer?style=flat-square)](https://github.com/joutvhu/ftp-transfer/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Node Version](https://img.shields.io/badge/node-%3E%3D24-brightgreen?style=flat-square)](package.json)

A GitHub Action to transfer files and directories to and from an FTP server, supporting batch script-like command execution, recursive uploads/downloads, directory manipulation, and zero-downtime deployment workflows.

---

## ✨ Features

- **Sequential Command Execution**: Run multiple FTP commands in a single step using simple newline-separated syntax.
- **Recursive Directory Transfer**: Upload (`put`) or download (`get`) entire folder hierarchies seamlessly.
- **Atomic / Zero-Downtime Deployment**: Easily stage files, swap directory names, and clean up previous releases.
- **Quoted Arguments**: Full support for paths containing spaces using single or double quotes.
- **Connection Customization**: Configure control and PASV timeouts, as well as keepalive ping intervals.
- **Error Control**: Choose whether failures immediately halt the workflow or capture error messages for downstream steps.

---

## 🚀 Quick Start

```yaml
- name: Deploy to FTP
  uses: joutvhu/ftp-transfer@v1
  with:
    host: ${{ secrets.FTP_HOST }}
    port: 21
    username: ${{ secrets.FTP_USERNAME }}
    password: ${{ secrets.FTP_PASSWORD }}
    commands: |
      put ./dist /public_html
```

---

## 📥 Inputs

| Input | Required | Default | Description |
| :--- | :---: | :---: | :--- |
| `host` | **Yes** | — | The hostname or IP address of the FTP server. |
| `port` | No | `21` | The port number of the FTP server. |
| `username` | No | `anonymous` | Username for FTP authentication. |
| `password` | No | `anonymous@` | Password for FTP authentication. |
| `commands` | **Yes** | — | Multi-line string containing the FTP commands to execute sequentially. |
| `connTimeout` | No | `10000` | Timeout in milliseconds to wait for the control connection to establish. |
| `pasvTimeout` | No | `10000` | Timeout in milliseconds to wait for a PASV data connection. |
| `keepalive` | No | `10000` | Interval in milliseconds to send `NOOP` keepalive commands. |
| `debug` | No | `false` | Enable verbose debug output from the FTP client. Accepts `true`, `1`, `yes`, `on`. |
| `throwing` | No | `true` | If `true`, the action fails when a command fails. If `false`, execution halts safely and outputs the error. |

---

## 📤 Outputs

| Output | Description |
| :--- | :--- |
| `succeed` | Number of commands executed successfully. |
| `message` | Error message if a command failed (available when `throwing: false`). |

---

## 🛠️ Supported Commands

Commands are specified under the `commands` input, one command per line. Arguments containing spaces should be enclosed in quotes (e.g. `'my folder'` or `"my folder"`).

| Command | Arguments | Description |
| :--- | :--- | :--- |
| `ls` | `[path]` | List contents of `path` (defaults to current remote directory). |
| `get` | `<remote_path> [local_dest]` | Download a file or entire directory from the server to `local_dest` (defaults to current local directory `.`). |
| `put` | `<local_path> [remote_dest]` | Upload a file or entire directory to `remote_dest` on the server (overwrites existing files). |
| `append` | `<local_path> [remote_dest]` | Same as `put`, but appends data to existing files instead of overwriting them. |
| `rename` | `<old_path> <new_path>` | Rename or move a file or directory on the server. |
| `delete` | `<path>` | Delete a remote file or recursively delete a remote directory. |
| `mkdir` | `<path>` | Create a directory on the server (automatically creates parent directories if needed). |
| `rmdir` | `<path>` | Recursively remove a directory and its contents on the server. |
| `cd` | `<path>` | Change the current working directory on the server. |
| `pwd` | — | Display the current working directory on the server. |

> [!TIP]
> **Directory paths with trailing slashes:**
> When specifying a destination directory for `put` or `get`, ending the path with a `/` ensures the item is placed inside that directory rather than renaming it.
>
> Example: `put ./build /public_html/` will place the contents of `build` into `/public_html`.

---

## 📋 Common Use Cases & Examples

### 1. Standard Web Deployment

Upload build artifacts directly to a web root directory:

```yaml
- name: Deploy Frontend
  uses: joutvhu/ftp-transfer@v1
  with:
    host: ${{ secrets.FTP_HOST }}
    username: ${{ secrets.FTP_USERNAME }}
    password: ${{ secrets.FTP_PASSWORD }}
    commands: |
      delete /var/www/html/dist
      put ./dist /var/www/html/dist
```

### 2. Zero-Downtime Deployment (Atomic Swap)

Upload new code to a temporary folder, swap folders using `rename`, and clean up the old version:

```yaml
- name: Zero-Downtime Deploy
  uses: joutvhu/ftp-transfer@v1
  with:
    host: ${{ secrets.FTP_HOST }}
    username: ${{ secrets.FTP_USERNAME }}
    password: ${{ secrets.FTP_PASSWORD }}
    commands: |
      put ./build ./build_new
      rename ./build ./build_old
      rename ./build_new ./build
      delete ./build_old
```

### 3. Downloading Backups or Remote Artifacts

Download database dumps or logs generated on the remote server:

```yaml
- name: Download Remote Backups
  uses: joutvhu/ftp-transfer@v1
  with:
    host: ${{ secrets.FTP_HOST }}
    username: ${{ secrets.FTP_USERNAME }}
    password: ${{ secrets.FTP_PASSWORD }}
    commands: |
      get /backups/db-latest.sql.gz ./backups/
      get /logs ./local_logs
```

### 4. Paths with Spaces

Wrap filenames or folder names containing whitespace in single or double quotes:

```yaml
- name: Upload Files with Spaces
  uses: joutvhu/ftp-transfer@v1
  with:
    host: ${{ secrets.FTP_HOST }}
    username: ${{ secrets.FTP_USERNAME }}
    password: ${{ secrets.FTP_PASSWORD }}
    commands: |
      put "dist files/my app.tar.gz" "release assets/app.tar.gz"
```

### 5. Graceful Error Handling (`throwing: false`)

Prevent the GitHub Action step from failing immediately when a command produces an error, and inspect the outcome in a subsequent step:

```yaml
- name: Clean up temporary files
  id: ftp_clean
  uses: joutvhu/ftp-transfer@v1
  with:
    host: ${{ secrets.FTP_HOST }}
    username: ${{ secrets.FTP_USERNAME }}
    password: ${{ secrets.FTP_PASSWORD }}
    throwing: false
    commands: |
      delete /temp/cache

- name: Check FTP cleanup status
  run: |
    echo "Commands succeeded: ${{ steps.ftp_clean.outputs.succeed }}"
    if [ -n "${{ steps.ftp_clean.outputs.message }}" ]; then
      echo "Notice: ${{ steps.ftp_clean.outputs.message }}"
    fi
```

---

## 🔒 Security Best Practices

- Always store sensitive information such as `host`, `username`, and `password` in [GitHub Encrypted Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets).
- Do not hardcode credentials in workflow files.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
