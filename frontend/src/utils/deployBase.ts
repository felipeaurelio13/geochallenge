export type DeployEnv = {
  viteBasePath?: string;
  githubActions?: string;
  githubRepository?: string;
};

export function resolveViteBase({ viteBasePath, githubActions, githubRepository }: DeployEnv) {
  if (viteBasePath) {
    return viteBasePath.endsWith('/') ? viteBasePath : `${viteBasePath}/`;
  }

  if (githubActions === 'true' && githubRepository) {
    const repoName = githubRepository.split('/')[1];
    if (repoName) {
      return `/${repoName}/`;
    }
  }

  return '/';
}
