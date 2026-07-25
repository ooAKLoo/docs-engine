import type {VideoHTMLAttributes} from 'react';
import {joinClassNames} from '../classnames.js';

export type VideoProps = Omit<VideoHTMLAttributes<HTMLVideoElement>, 'children' | 'src'> & {
  /** A URL supplied by the host application or its media resolver. */
  src: string;
  /** Accessible name and visible caption for the media. */
  title: string;
};

/**
 * A storage-agnostic document video primitive. It deliberately accepts only a
 * playable URL: hosts own authorization, CDN/object-store selection, and URL
 * renewal, while Docs Engine owns the document semantics and player rendering.
 */
export function Video({className, poster, src, title, ...props}: VideoProps) {
  return (
    <figure className={joinClassNames('de-video', className)}>
      <video
        aria-label={title}
        controls
        playsInline
        poster={poster}
        preload="metadata"
        src={src}
        {...props}
      />
      <figcaption>{title}</figcaption>
    </figure>
  );
}
