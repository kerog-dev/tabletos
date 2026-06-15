import * as React from "react";

export default class ErrorBoundary extends React.Component {
  declare state: Readonly<{ hasError: boolean; error: unknown | undefined }>;
  declare props: { renderer: (error: unknown) => React.ReactNode; children: any };

  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: undefined };
  }

  static getDerivedStateFromError(error: unknown) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return this.props.renderer(this.state.error);
    }

    return this.props.children;
  }
}
