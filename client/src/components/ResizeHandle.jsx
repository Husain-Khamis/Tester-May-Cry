import { Separator } from 'react-resizable-panels'

function ResizeHandle({ vertical, ...props }) {
  return (
    <Separator
      {...props}
      className={`shrink-0 bg-brass/40 transition-colors hover:bg-crimson data-[separator=active]:bg-crimson ${
        vertical ? 'h-1.5 cursor-row-resize' : 'w-1.5 cursor-col-resize'
      }`}
    />
  )
}

export default ResizeHandle
