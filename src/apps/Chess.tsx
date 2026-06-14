import { Chessboard, type PieceDropHandlerArgs } from 'react-chessboard'
import { Chess } from 'chess.js'
import type { Square } from 'chess.js'
import { useEffect, useMemo, useRef, useState } from 'react';

export default function ChessApp() {
  const gameRef = useRef(new Chess())
  const game = gameRef.current

  const [chessPosition, setChessPosition] = useState(game.fen())
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null)
  const [availableMoves, setAvailableMoves] = useState<Square[]>([])
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null)
  const [statusText, setStatusText] = useState('White to move')
  const [gameOver, setGameOver] = useState(false)

  const [size, setSize] = useState(Math.min(window.innerWidth, window.innerHeight));

  useEffect(() => {
    const onResize = () => setSize(Math.min(window.innerWidth, window.innerHeight))
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  function syncStatus() {
    const side = game.turn() === 'w' ? 'White' : 'Black'
    if (game.isCheckmate()) { setStatusText(`${side === 'White' ? 'Black' : 'White'} wins by checkmate`); setGameOver(true) }
    else if (game.isStalemate()) { setStatusText('Stalemate · Draw'); setGameOver(true) }
    else if (game.isDraw()) { setStatusText('Draw'); setGameOver(true) }
    else if (game.inCheck()) setStatusText(`${side} is in check`)
    else setStatusText(`${side} to move`)
  }

  function doMove(from: Square, to: Square): boolean {
    try {
      game.move({ from, to, promotion: 'q' })
      setChessPosition(game.fen())
      setLastMove({ from, to })
      setSelectedSquare(null)
      setAvailableMoves([])
      syncStatus()
      return true
    } catch { return false }
  }

  function onPieceDrop({ sourceSquare, targetSquare }: PieceDropHandlerArgs) {
    if (!targetSquare) return false
    return doMove(sourceSquare as Square, targetSquare as Square)
  }

  function onSquareClick({ square }: { square: any }) {
    if (gameOver) return
    if (selectedSquare && availableMoves.includes(square)) {
      doMove(selectedSquare, square); return
    }
    const piece = game.get(square)
    if (piece && piece.color === game.turn()) {
      setSelectedSquare(square)
      setAvailableMoves(game.moves({ square, verbose: true }).map(m => m.to as Square))
    } else {
      setSelectedSquare(null); setAvailableMoves([])
    }
  }
  const customSquareStyles = useMemo(() => {
    const s: Record<string, { background: string }> = {}
    if (lastMove) {
      s[lastMove.from] = { background: 'rgba(155, 199, 0, 0.41)' }
      s[lastMove.to] = { background: 'rgba(155, 199, 0, 0.41)' }
    }
    if (selectedSquare) s[selectedSquare] = { background: 'rgba(20, 85, 30, 0.5)' }
    for (const sq of availableMoves) {
      s[sq] = game.get(sq)
        ? { background: 'radial-gradient(transparent 0 58%, rgba(20,85,30,.35) 58% 68%, transparent 68%)' }
        : { background: 'radial-gradient(rgba(20,85,30,.35) 25%, transparent 26%)' }
    }
    if (game.inCheck())
      for (const row of game.board())
        for (const p of row)
          if (p?.type === 'k' && p.color === game.turn())
            s[p.square] = { background: 'radial-gradient(circle, #f00c 0%, #f006 40%, transparent 70%)' }
    return s
  }, [selectedSquare, availableMoves, lastMove, chessPosition])


  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Chessboard options={{
        allowDragging: true,
        position: chessPosition,
        id: 'player-vs-player',
        boardStyle: { width: size, ...customSquareStyles },
        onPieceDrop,
        onSquareClick,
      }} />
      <div style={{ position: 'absolute', top: 0, left: 0, zIndex: 999, marginTop: 8, fontSize: 13, color: gameOver ? '#e55' : '#888' }}>
        {statusText}
      </div>
    </div>
  );
}
