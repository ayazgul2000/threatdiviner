# GitHub CLI script to set up test branches and PRs for Gittest
# Run from the Gittest repo directory or update $repoPath

$repoOwner = "your-github-username"  # UPDATE THIS
$repoName = "Gittest"

# Clone if needed (skip if already cloned)
# git clone https://github.com/$repoOwner/$repoName.git
# cd $repoName

# Create and push develop branch (protected)
git checkout -b develop
echo "# Develop Branch" > DEVELOP.md
git add DEVELOP.md
git commit -m "Initialize develop branch"
git push -u origin develop

# Create feature/auth branch from develop
git checkout -b feature/auth
echo "// Auth feature code" > auth.js
git add auth.js
git commit -m "feat: add authentication module"
git push -u origin feature/auth

# Create PR from feature/auth to develop
gh pr create --base develop --head feature/auth --title "feat: Add authentication" --body "Adds OAuth2 authentication support"

# Create feature/api branch from develop  
git checkout develop
git checkout -b feature/api
echo "// API feature code" > api.js
git add api.js
git commit -m "feat: add API endpoints"
git push -u origin feature/api

# Create PR from feature/api to develop
gh pr create --base develop --head feature/api --title "feat: Add API endpoints" --body "Adds REST API endpoints"

# Merge feature/auth PR to develop (simulate approval)
gh pr merge feature/auth --merge --admin

# Now create PR from develop to main
git checkout develop
git pull
gh pr create --base main --head develop --title "Release: Merge develop to main" --body "Release candidate from develop"

Write-Host ""
Write-Host "Done! Created:"
Write-Host "  - develop branch (protected)"
Write-Host "  - feature/auth -> PR to develop (merged)"
Write-Host "  - feature/api -> PR to develop (open)"
Write-Host "  - develop -> PR to main (open)"
Write-Host ""
Write-Host "Go to GitHub Settings > Branches to mark 'develop' and 'main' as protected"
