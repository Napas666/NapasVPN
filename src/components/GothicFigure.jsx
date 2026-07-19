import { motion } from 'framer-motion';

const SRC = (process.env.PUBLIC_URL || '.') + '/gothic_figure.png';

/**
 * Full-bleed gothic figure shown behind the VPN panel while connected.
 * Reveal: emerges out of black — blur + zoom + ink-mask iris opening —
 * then breathes slowly with a faint glow pulse over the eye.
 */
export default function GothicFigure() {
  return (
    <motion.div
      className="gothic-figure"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.5 } }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
    >
      {/* The image — revealed with an expanding iris + un-blur + slow breathing */}
      <motion.img
        src={SRC}
        alt=""
        draggable={false}
        className="gothic-figure-img"
        initial={{ scale: 1.22, filter: 'blur(16px) brightness(0.35)', clipPath: 'circle(12% at 47% 55%)' }}
        animate={{
          scale: [1.22, 1.05, 1.08, 1.05],
          filter: [
            'blur(16px) brightness(0.35)',
            'blur(0px) brightness(1)',
            'blur(0px) brightness(1.03)',
            'blur(0px) brightness(1)',
          ],
          clipPath: [
            'circle(12% at 47% 55%)',
            'circle(82% at 50% 48%)',
            'circle(82% at 50% 48%)',
            'circle(82% at 50% 48%)',
          ],
        }}
        transition={{
          duration: 8,
          times: [0, 0.16, 0.58, 1],
          ease: 'easeInOut',
          repeat: Infinity,
          repeatType: 'mirror',
        }}
      />

      {/* Scrim so the button + text stay readable on top */}
      <div className="gothic-figure-scrim" />

      {/* Faint glow that pulses over the eye */}
      <motion.div
        className="gothic-figure-glow"
        animate={{ opacity: [0.0, 0.35, 0.0] }}
        transition={{ duration: 3.4, ease: 'easeInOut', repeat: Infinity }}
      />
    </motion.div>
  );
}
