const fs = require("fs-extra")
const alex = require("alex")
const path = require("path")

let EXTENSIONS_TO_CHECK = {md: 'md', txt: 'text', text: 'text', html: 'html', yaml: 'text', yml: 'text'}

async function findPreviousComment(octokit, repo, issue_number, message_id) {
  const HEADER = `<!-- Alex Pull Request Comment - ${message_id} -->`; // Always a technical comment
  const { data: comments } = await octokit.issues.listComments({
    ...repo,
    issue_number
  });
  return comments.find(comment => comment.body.startsWith(HEADER));
}

async function createComment(octokit, repo, issue_number, message_id, comment) {
  const HEADER = `<!-- Alex Pull Request Comment - ${message_id} -->`;
  await octokit.issues.createComment({
    ...repo,
    issue_number,
    body: `${HEADER}\n${comment}`
  });
}

async function updateComment(octokit, repo, comment_id, message_id, comment) {
  const HEADER = `<!-- Alex Pull Request Comment - ${message_id} -->`;
  await octokit.issues.updateComment({
    ...repo,
		comment_id,
    body: `${HEADER}\n${comment}`
  });
}

function getExt(file) {
	return path.extname(file).slice(1)
}


function checkFile(file, options) {
	console.warn(`checking ${file}`)
	const extension = getExt(file)
	const checkType = EXTENSIONS_TO_CHECK[extension]

	const body = fs.readFileSync(file, "utf-8");

	if (checkType === 'text') {
		return alex.text(body, options)
	} else if (checkType === 'md') {
		return alex.markdown(body, options)
	} else if (checkType === 'html') {
		return alex.html(body, options)
	}
}

function formatRow(msg) {
	let status = `:warning:`
	if (msg.fatal) {
		status = `:stop_sign:`
	}

	return `| ${status} | ${msg.line}:${msg.column} | ${msg.actual} | ${msg.reason} |`
}

function formatFileTable(res) {
	// don't post anything for files that are good
	if (res.result.messages.length == 0) {
		return ''
	}

	let filePath = path.relative(process.cwd(), res.filePath)
	let header = `### ${filePath}\n`
	let tableHeader = `| Level | Location | Word | Recommendation |\n| :---: | :---: | :---: | :--- |\n`

	let rows = res.result.messages.map(msg => formatRow(msg))

	return `${header}${tableHeader}${rows.join('\n')}\n`
}

function formatComment(checkRes) {
	let header = `# Alex Recommends Report\n Alex recommends the following language changes, but Alex is a regular expression based algorithm, so take them with a grain of salt.\n`
	let success = `### :sparkles: :rocket: :sparkles: Nothing to Report :sparkles: :rocket: :sparkles:`

	let sections = checkRes.map(res => formatFileTable(res))

	if (sections.every(section => section === '') || sections.length == 0) {
		return `${header}${success}`
	} else {
		return `${header}${sections.join('\n')}`
	}

}

function checkAlex(filesList, noBinary, profanitySureness) {
	const filteredFilesList = filesList.filter((value) => fs.existsSync(value));
	const options = {noBinary: noBinary, profanitySureness: profanitySureness}

	let checkRes = filteredFilesList.map(file => {
		const resp = checkFile(file, options)
		return {filePath: file, result: resp}
	})

	return formatComment(checkRes)
}

module.exports = {
	findPreviousComment,
	createComment,
	updateComment,
	EXTENSIONS_TO_CHECK,
	checkAlex,
	getExt
}
