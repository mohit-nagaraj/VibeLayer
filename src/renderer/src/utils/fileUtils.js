export function toFileUrl(filePath) {
  let path = filePath.replace(/\\/g, '/')

  if (/^[A-Za-z]:\//.test(path)) {
    // Ensure three slashes for Windows drive paths and encode the path
    return 'file:///' + encodeURI(path)
  }

  // Handle other paths (e.g., network paths, relative paths)
  return 'file://' + encodeURI(path)
}
