const { Octokit } = require("@octokit/rest")

const OWNER = 'trustbit'
const REPO = 'CargoSimulation-Experiments'
const WORKFLOW_ID = 'ci.yml'
const RUN_ID = '3091145696'

const octo = new Octokit({
  auth: process.env.TOKEN
})

const getPreviousRun = async (currentRun) => {
  const response = await
    octo.rest.actions.listWorkflowRuns({
      owner: OWNER,
      repo: REPO,
      workflow_id: WORKFLOW_ID
    })

  const relevantRunsByDate = 
    response.data.workflow_runs
      .filter( r => r.head_branch === currentRun.head_branch )
      .sort( (r1, r2) => r1.run_number - r2.run_number )

  const currentRunIndex = relevantRunsByDate.findIndex( r => r.id === currentRun.id )

  if (currentRunIndex === -1)
    throw Error('Could not find current run.')
  if (currentRunIndex === 0)
    return {}
  else {
    const previousRun = relevantRunsByDate[currentRunIndex - 1]
    if (previousRun.conclusion === 'success') {
      return {
        previousRun
      }
    } else {
      const allPreviousRuns = relevantRunsByDate.slice(0, previousRun)
      const lastSuccesfulRun =
      allPreviousRuns
          .reverse()
          .find(r => r.conclusion === 'success')

      return {
        previousRun,
        lastSuccesfulRun
      }
    }
  }
}

const getDiffLink = (commit1, commit2) => 
  `https://github.com/${OWNER}/${REPO}/compare/${commit2.substring(0, 7)}...${commit1.substring(0, 7)}`


const runUrlMessage = (runText, run) => `${runText}: ${run.html_url}`

const diffMessage = (runText, run1, run2) =>
  `Diff between ${runText} and this run: ${getDiffLink(run1.head_sha, run2.head_sha)}`

const getOutput = async () => {
  const response = await
    octo.rest.actions.getWorkflowRun({
      owner: OWNER,
      repo: REPO,
      run_id: RUN_ID
    })

  const currentRun = response.data

  const { previousRun, lastSuccesfulRun: lastSuccesfullRun } = await getPreviousRun(currentRun)

  if (!previousRun) {
    return "No information on previous runs: this is the first workflow run on this branch."
  } else {
    const outputMessage = []

    if (previousRun.conclusion === 'success') {
      outputMessage.push(`The previous run (${previousRun.created_at}) was successful.`)
      outputMessage.push(runUrlMessage("Previous run", previousRun))
      outputMessage.push(diffMessage("previous run", currentRun, previousRun))
    } else {
      
      if (!previousRun.conclusion) {
        outputMessage.push(`The previous run (${previousRun.created_at}) is still in progress.`)
      } else {
        outputMessage.push(`The previous run (${previousRun.created_at}) concluded with '${previousRun.conclusion}'.`)
      }
      outputMessage.push(runUrlMessage("Previous run", previousRun))
      if (!lastSuccesfullRun) {
        outputMessage.push("There was no succesful run.")
      } else {
        outputMessage.push(`The last succesful run was at ${lastSuccesfullRun.created_at}.`)
        outputMessage.push(runUrlMessage("Last succesfull run", lastSuccesfullRun))
        outputMessage.push(diffMessage("last succesfull run", currentRun, lastSuccesfullRun))
      }
    }

    return outputMessage.join("\n")
  }
}

const main = async () => {
  const output = await getOutput()
  console.log(output)
}

main().then().catch(console.error)

