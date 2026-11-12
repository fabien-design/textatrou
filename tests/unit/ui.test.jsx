import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button, Card, Toggle, Modal, Pill } from '../../src/components/ui';

const has = (el, ...c) => c.every((x) => el.classList.contains(x));

describe('Button', () => {
  it('renders a button element', () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole('button', { name: 'Go' }).tagName === 'BUTTON').toBe(true);
  });
  it('has base brutal classes', () => {
    render(<Button>Go</Button>);
    expect(has(screen.getByRole('button'), 'rounded-2xl', 'border-2', 'border-ink', 'shadow-brutal')).toBe(true);
  });
  it('has an active translate class', () => {
    render(<Button>Go</Button>);
    expect([...screen.getByRole('button').classList].some((c) => c.startsWith('active:translate'))).toBe(true);
  });
  it('defaults to primary bg-sun', () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole('button').classList.contains('bg-sun')).toBe(true);
  });
  it.each([
    ['white', 'bg-white'],
    ['coral', 'bg-coral'],
    ['mint', 'bg-mint'],
    ['cyan', 'bg-cyan'],
    ['grape', 'bg-grape'],
  ])('variant %s gives %s', (variant, cls) => {
    render(<Button variant={variant}>Go</Button>);
    expect(screen.getByRole('button').classList.contains(cls)).toBe(true);
  });
  it('appends extra className', () => {
    render(<Button className="my-extra">Go</Button>);
    expect(screen.getByRole('button').classList.contains('my-extra')).toBe(true);
  });
  it('calls onClick when clicked', async () => {
    const fn = vi.fn();
    render(<Button onClick={fn}>Go</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it('is disabled when disabled', () => {
    render(<Button disabled>Go</Button>);
    expect(screen.getByRole('button').disabled).toBe(true);
  });
  it('does not call onClick when disabled', async () => {
    const fn = vi.fn();
    render(<Button disabled onClick={fn}>Go</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(fn).not.toHaveBeenCalled();
  });
  it('passes rest props', () => {
    render(<Button aria-label="lbl" type="submit">Go</Button>);
    const b = screen.getByRole('button');
    expect(b.getAttribute('aria-label') === 'lbl' && b.getAttribute('type') === 'submit').toBe(true);
  });
});

describe('Card', () => {
  it('has card classes', () => {
    render(<Card><span>x</span></Card>);
    const el = screen.getByText('x').parentElement;
    expect(has(el, 'rounded-2xl', 'border-2', 'border-ink', 'shadow-brutal', 'bg-white')).toBe(true);
  });
  it('renders children', () => {
    render(<Card>hello</Card>);
    expect(screen.queryByText('hello') !== null).toBe(true);
  });
  it('appends className', () => {
    render(<Card className="extra">hello</Card>);
    expect(screen.getByText('hello').classList.contains('extra')).toBe(true);
  });
});

describe('Toggle', () => {
  it('has role switch', () => {
    render(<Toggle checked={false} onChange={() => {}} label="Son" />);
    expect(screen.queryByRole('switch') !== null).toBe(true);
  });
  it('aria-checked true when checked', () => {
    render(<Toggle checked onChange={() => {}} label="Son" />);
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true');
  });
  it('aria-checked false when unchecked', () => {
    render(<Toggle checked={false} onChange={() => {}} label="Son" />);
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('false');
  });
  it('accessible name contains label', () => {
    render(<Toggle checked={false} onChange={() => {}} label="Son" />);
    expect(screen.queryByRole('switch', { name: /Son/ }) !== null).toBe(true);
  });
  it('click calls onChange(true) when unchecked', async () => {
    const fn = vi.fn();
    render(<Toggle checked={false} onChange={fn} label="Son" />);
    await userEvent.click(screen.getByRole('switch'));
    expect(fn).toHaveBeenCalledWith(true);
  });
  it('click calls onChange(false) when checked', async () => {
    const fn = vi.fn();
    render(<Toggle checked onChange={fn} label="Son" />);
    await userEvent.click(screen.getByRole('switch'));
    expect(fn).toHaveBeenCalledWith(false);
  });
});

describe('Modal', () => {
  it('renders nothing when closed', () => {
    render(<Modal open={false} onClose={() => {}} title="T">body</Modal>);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('renders dialog when open', () => {
    render(<Modal open onClose={() => {}} title="T">body</Modal>);
    expect(screen.queryByRole('dialog') !== null).toBe(true);
  });
  it('dialog has aria-modal true', () => {
    render(<Modal open onClose={() => {}} title="T">body</Modal>);
    expect(screen.getByRole('dialog').getAttribute('aria-modal')).toBe('true');
  });
  it('shows title', () => {
    render(<Modal open onClose={() => {}} title="Mon titre">body</Modal>);
    expect(screen.queryByText('Mon titre') !== null).toBe(true);
  });
  it('shows children', () => {
    render(<Modal open onClose={() => {}} title="T"><p>contenu</p></Modal>);
    expect(screen.queryByText('contenu') !== null).toBe(true);
  });
  it('close button calls onClose', async () => {
    const fn = vi.fn();
    render(<Modal open onClose={fn} title="T">body</Modal>);
    await userEvent.click(screen.getByRole('button', { name: /fermer/i }));
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it('backdrop click calls onClose', async () => {
    const fn = vi.fn();
    render(<Modal open onClose={fn} title="T">body</Modal>);
    await userEvent.click(screen.getByTestId('modal-backdrop'));
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it('click inside content does not call onClose', async () => {
    const fn = vi.fn();
    render(<Modal open onClose={fn} title="T"><p>inside</p></Modal>);
    await userEvent.click(screen.getByText('inside'));
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('Pill', () => {
  it('has pill classes', () => {
    render(<Pill>tag</Pill>);
    const el = screen.getByText('tag');
    expect(has(el, 'rounded-full', 'border-2', 'border-ink')).toBe(true);
  });
  it('is a span', () => {
    render(<Pill>tag</Pill>);
    expect(screen.getByText('tag').tagName === 'SPAN').toBe(true);
  });
  it('defaults to bg-mint', () => {
    render(<Pill>tag</Pill>);
    expect(screen.getByText('tag').classList.contains('bg-mint')).toBe(true);
  });
  it('uses given color', () => {
    render(<Pill color="coral">tag</Pill>);
    expect(screen.getByText('tag').classList.contains('bg-coral')).toBe(true);
  });
});
