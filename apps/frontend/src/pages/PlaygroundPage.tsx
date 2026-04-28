// Placeholder. The real chat playground UI lands in Step 10.

import PagePlaceholder from '../components/PagePlaceholder.js';

export default function PlaygroundPage(): JSX.Element {
  return (
    <PagePlaceholder
      title="Playground"
      description="Send a prompt to the worker pool and stream tokens back via SSE. Stop button aborts the worker generator."
    />
  );
}
