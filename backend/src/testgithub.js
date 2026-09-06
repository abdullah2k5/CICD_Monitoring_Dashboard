require('dotenv').config();

async function main() {
  const owner = 'abdullah2k5';
  const repo = 'CICD_Monitoring_Dashboard'; // pick any repo that actually has GitHub Actions runs

  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/runs`, {
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      'User-Agent': 'cicd-monitoring-dashboard'
    }
  });

  const data = await response.json();

  if (!data.workflow_runs || data.workflow_runs.length === 0) {
    console.log('No workflow runs found for this repo. Total count:', data.total_count);
    return;
  }

  const simplified = data.workflow_runs.map(run => ({
    id: run.id,
    name: run.name,
    status: run.status,
    conclusion: run.conclusion,
    head_branch: run.head_branch,
    head_sha: run.head_sha,
    run_started_at: run.run_started_at,
    updated_at: run.updated_at,
    html_url: run.html_url
  }));

  console.log(simplified);
}

main();