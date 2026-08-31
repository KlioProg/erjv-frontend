import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 1. Configure Directories
const backendDir = path.resolve(__dirname, '../erjv-backend/src')
const frontendDir = path.resolve(__dirname, './src')

function findFiles(dir, filterExt) {
  let results = []
  if (!fs.existsSync(dir)) return results
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results = results.concat(findFiles(full, filterExt))
    } else if (entry.name.endsWith(filterExt)) {
      results.push(full)
    }
  }
  return results
}

// 2. Collect Backend Endpoints from NestJS Controllers
function collectBackendEndpoints() {
  const controllerFiles = findFiles(backendDir, '.controller.ts')
  const endpoints = []

  for (const file of controllerFiles) {
    const content = fs.readFileSync(file, 'utf8')
    const controllerMatch = content.match(/@Controller\((?:['"`](.*?)['"`])?\)/)
    const basePath = controllerMatch && controllerMatch[1] ? controllerMatch[1] : ''

    const methodRegex =
      /@(Get|Post|Patch|Delete|Put)\((?:['"`](.*?)['"`])?\)([\s\S]*?\n\s*(?:async\s+)?(\w+)\s*\([^)]*\)[\s\S]*?\{)/g
    let match
    while ((match = methodRegex.exec(content)) !== null) {
      const httpMethod = match[1].toUpperCase()
      const rawSubPath = match[2] || ''
      const methodBlock = match[3]
      const handlerName = match[4]

      const roleMatch = methodBlock.match(/@Roles\(([^)]*)\)/)
      const roles = roleMatch ? roleMatch[1].replace(/['"`\s]/g, '').split(',') : ['AUTHENTICATED']

      const subPath = rawSubPath ? (rawSubPath.startsWith('/') ? rawSubPath : '/' + rawSubPath) : ''
      const fullPath = ('/' + basePath + subPath).replace(/\/+/g, '/').replace(/\/$/, '') || '/'

      endpoints.push({
        method: httpMethod,
        path: fullPath,
        roles,
        controller: path.basename(file),
        handler: handlerName,
      })
    }
  }
  return endpoints
}

// 3. Collect Frontend API Calls
function collectFrontendApiCalls() {
  const apiFiles = findFiles(frontendDir, '.ts').concat(findFiles(frontendDir, '.tsx'))
  const calls = []

  for (const file of apiFiles) {
    const content = fs.readFileSync(file, 'utf8')
    const apiCallRegex = /apiClient\.(get|post|patch|delete|put)(?:<[^>]*>)?\(\s*[`'"](.*?)['"`]/g
    let match
    while ((match = apiCallRegex.exec(content)) !== null) {
      const httpMethod = match[1].toUpperCase()
      let rawPath = match[2]

      let normalizedPath =
        rawPath
          .replace(/\$\{[^}]+\}/g, (v) => {
            if (v.toLowerCase().includes('id')) return ':id'
            if (v.toLowerCase().includes('email')) return ':email'
            if (v.toLowerCase().includes('plate')) return ':plateNumber'
            if (v.toLowerCase().includes('name')) return ':name'
            return ':param'
          })
          .replace(/\/+/g, '/')
          .replace(/\/$/, '') || '/'

      calls.push({
        method: httpMethod,
        rawPath,
        normalizedPath,
        file: path.relative(frontendDir, file),
      })
    }
  }

  const uniqueMap = new Map()
  for (const c of calls) {
    const key = `${c.method} ${c.normalizedPath}`
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, { ...c, files: [c.file] })
    } else {
      uniqueMap.get(key).files.push(c.file)
    }
  }

  return Array.from(uniqueMap.values())
}

// 4. Compare and Print Audit Report
function runAudit() {
  console.log('\n======================================================')
  console.log('🚀 ERJVPOS Full API & Endpoint Cross-Reference Audit')
  console.log('======================================================\n')

  const backend = collectBackendEndpoints()
  const frontend = collectFrontendApiCalls()

  console.log(`📦 Found ${backend.length} Backend Routes in '${path.basename(backendDir)}'`)
  console.log(
    `💻 Found ${frontend.length} Unique Frontend API Calls in '${path.basename(frontendDir)}'\n`,
  )

  console.log('--- 🟢 MATCHED ENDPOINTS (Frontend ➔ Backend) ---')
  let matchCount = 0

  for (const fe of frontend) {
    const beMatch = backend.find(
      (b) =>
        b.method === fe.method &&
        (b.path === fe.normalizedPath ||
          b.path.replace(/:[a-zA-Z0-9_]+/g, ':id') ===
            fe.normalizedPath.replace(/:[a-zA-Z0-9_]+/g, ':id')),
    )

    if (beMatch) {
      matchCount++
      console.log(
        `✅ [${fe.method.padEnd(6)}] ${fe.normalizedPath.padEnd(52)} ➔ ${beMatch.controller}#${beMatch.handler} (${beMatch.roles.join(', ')})`,
      )
    }
  }

  console.log(`\n--- 🔍 BACKEND ROUTES NOT CALLED BY FRONTEND (${backend.length - matchCount}) ---`)
  for (const be of backend) {
    const isCalled = frontend.some(
      (fe) =>
        fe.method === be.method &&
        (fe.normalizedPath === be.path ||
          fe.normalizedPath.replace(/:[a-zA-Z0-9_]+/g, ':id') ===
            be.path.replace(/:[a-zA-Z0-9_]+/g, ':id')),
    )

    if (!isCalled) {
      console.log(
        `🔹 [${be.method.padEnd(6)}] ${be.path.padEnd(52)} ➔ ${be.controller}#${be.handler} (${be.roles.join(', ')})`,
      )
    }
  }

  console.log('\n======================================================\n')
}

runAudit()
