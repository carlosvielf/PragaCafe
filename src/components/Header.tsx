import { Leaf, ArrowUpRight } from 'lucide-react';
export function Logo() { return <a className="logo" href="#" aria-label="PragaCaféIA início"><span className="logo-mark"><Leaf size={24}/><i/></span><span>PragaCafé<span className="logo-ai">IA</span></span></a>; }
export function Header() { return <header><div className="header-inner"><Logo/><nav aria-label="Menu principal"><a href="#como-funciona">Como funciona</a><a href="#o-que-identificamos">O que identificamos</a><a className="nav-action" href="#analisar">Nova análise <ArrowUpRight size={16}/></a></nav></div></header>; }
