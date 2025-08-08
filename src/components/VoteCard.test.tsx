import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { VoteCard } from './VoteCard';

describe('VoteCard', () => {
  it('increments on click', () => {
    const onInc = jest.fn();
    const onDec = jest.fn();
    render(
      <VoteCard
        id="c1"
        name="Alice"
        party="Partido A"
        count={0}
        onIncrement={onInc}
        onDecrement={onDec}
      />
    );
    fireEvent.click(screen.getByTestId('vote-card-c1'));
    expect(onInc).toHaveBeenCalled();
  });

  it('decrements on minus button', () => {
    const onInc = jest.fn();
    const onDec = jest.fn();
    render(
      <VoteCard
        id="c1"
        name="Alice"
        party="Partido A"
        count={1}
        onIncrement={onInc}
        onDecrement={onDec}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Restar 1/ }));
    expect(onDec).toHaveBeenCalled();
  });

  it('keyboard support Enter/Space and Shift+Enter', () => {
    const onInc = jest.fn();
    const onDec = jest.fn();
    render(
      <VoteCard
        id="c1"
        name="Alice"
        party="Partido A"
        count={0}
        onIncrement={onInc}
        onDecrement={onDec}
      />
    );
    const btn = screen.getByTestId('vote-card-c1');
    fireEvent.keyDown(btn, { key: 'Enter' });
    fireEvent.keyDown(btn, { key: ' ' });
    fireEvent.keyDown(btn, { key: 'Enter', shiftKey: true });
    expect(onInc).toHaveBeenCalledTimes(2);
    expect(onDec).toHaveBeenCalledTimes(1);
  });
});

