# FTP Transfer

GitHub Action to transfer files to and from a computer running an FTP server service.

## Usage

See [action.yml](action.yml)

## Inputs

- `host`: The hostname or IP address of the FTP server. Required
- `port`: The port of the FTP server. Default: `21`.
- `username`: Username for authentication. Default: `anonymous`
- `password`: Password for authentication. Default: `anonymous@`
- `connTimeout`: How long (in milliseconds) to wait for the control connection to be established. Default: `10000`
- `pasvTimeout`: How long (in milliseconds) to wait for a PASV data connection to be established. Default: `10000`
- `keepalive`: How often (in milliseconds) to send a "dummy" (NOOP) command to keep the connection alive. Default: `10000`
- `commands`: The ftp commands. Required

## Commands

- `ls [path]`: Retrieves the directory listing of `path`. `path` defaults to the current working directory.
- `get <remote_path> <local_path>`:  Retrieves a file or directory at `remote_path` from the server.
- `put <local_path> <remote_path>`: Sends file or directory to the server to be stored as `remote_path`.
- `append <local_path> <remote_path>`: Same as `put`, except if file already exists, it will be appended to instead of overwritten.
- `rename <old_path> <new_path>`: Renames `old_path` to `new_path` on the server.
- `delete <path>`:  Deletes a file or directory on the server.
- `cd <path>`: Changes the current working directory to `path`.
- `pwd <path>`: Retrieves the current working directory.
- `mkdir <path>`: Creates a new directory `path` on the server.
- `rmdir <path>`: Removes a directory `path` on the server.

## Example

```yaml
steps:
  - uses: joutvhu/ftp-transfer@v1
    with:
      host: localhost
      port: 21
      username: joutvhu
      password: ${{ secrets.FTP_PASSWORD }}
      commands: |
        put ./build ./build.new
        rename ./build ./build.old
        rename ./build.new ./build
        delete ./build.old
```
