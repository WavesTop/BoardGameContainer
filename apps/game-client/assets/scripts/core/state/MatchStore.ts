export interface MatchView<TView = unknown> {
  matchId: string;
  revision: number;
  value: TView;
}

export class MatchStore<TView = unknown> {
  private current?: MatchView<TView>;

  get snapshot(): MatchView<TView> | undefined {
    return this.current;
  }

  replace(snapshot: MatchView<TView>): void {
    this.current = structuredClone(snapshot);
  }

  applyRevision(revision: number, update: (current: TView) => TView): void {
    if (!this.current) throw new Error("Match snapshot is not initialized");
    if (revision !== this.current.revision + 1) {
      throw new Error(
        `Revision gap: expected ${this.current.revision + 1}, received ${revision}`,
      );
    }
    this.current = {
      ...this.current,
      revision,
      value: update(this.current.value),
    };
  }

  reset(): void {
    this.current = undefined;
  }
}
