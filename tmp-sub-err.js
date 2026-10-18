const fs = require('fs')
const path = require('path')
const os = require('os')

const s = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.expo', 'state.json'), 'utf8'))
const session = s.auth.sessionSecret

async function gql(query) {
  const res = await fetch('https://api.expo.dev/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'expo-session': session,
    },
    body: JSON.stringify({ query }),
  })
  return res.json()
}

async function main() {
  for (const id of ['8ec53e78-12ae-40d5-9d35-ae1b4fdd33f4']) {
    const r = await gql(`
      {
        submissions {
          byId(submissionId: "${id}") {
            id
            status
            archiveUrl
            error { errorCode message }
            iosConfig {
              appleIdUsername
              ascAppIdentifier
              ascApiKeyId
            }
            jobRun {
              id
              status
              displayName
              logFileUrls
              errors { message errorCode docsUrl buildPhase }
              startedAt
              endedAt
            }
          }
        }
      }
    `)
    console.log('\n===', id)
    console.log(JSON.stringify(r, null, 2))

    const urls = r.data?.submissions?.byId?.jobRun?.logFileUrls || []
    for (const url of urls) {
      const text = await (await fetch(url)).text()
      console.log('\n==== LOG ====\n', text.slice(-4500))
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
