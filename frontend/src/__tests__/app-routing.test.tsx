import { describe, expect, it } from 'vitest';
import React from 'react';
import { appRoutes, SinglePlayerGameLayout, RankingsPage, CompetitionPage } from '../App';

describe('App single-player routing', () => {
  it('keeps /game/single and /results under the same GameProvider layout', () => {
    const rootRoute = appRoutes[0];
    const singlePlayerParent = rootRoute.children?.find(
      (route) => Array.isArray(route.children) && route.children.some((child) => child.path === '/game/single')
    );

    expect(singlePlayerParent).toBeDefined();
    expect(singlePlayerParent?.children?.some((child) => child.path === '/results')).toBe(true);

    const protectedElement = singlePlayerParent?.element as React.ReactElement;
    const layoutElement = protectedElement.props.children as React.ReactElement;

    expect(layoutElement.type).toBe(SinglePlayerGameLayout);
  });
});


describe('Challenge routing', () => {
  it('defines a dedicated route for challenge results', () => {
    const rootRoute = appRoutes[0];
    expect(rootRoute.children?.some((route) => route.path === '/challenges/:id/results')).toBe(true);
  });
});


describe('Rankings routing', () => {
  it('exposes /rankings without requiring ProtectedRoute', () => {
    const rootRoute = appRoutes[0];
    const rankingsRoute = rootRoute.children?.find((route) => route.path === '/rankings');

    expect(rankingsRoute).toBeDefined();
    const rankingsElement = rankingsRoute?.element as React.ReactElement;
    expect(rankingsElement.type).toBe(RankingsPage);
  });
});

describe('Competition routing', () => {
  it('protects /competition and renders CompetitionPage inside the guard', () => {
    const rootRoute = appRoutes[0];
    const competitionRoute = rootRoute.children?.find((route) => route.path === '/competition');

    expect(competitionRoute).toBeDefined();
    const protectedElement = competitionRoute?.element as React.ReactElement;
    const pageElement = protectedElement.props.children as React.ReactElement;

    expect(pageElement.type).toBe(CompetitionPage);
    expect(protectedElement.type).not.toBe(CompetitionPage);
  });
});
