import { useState, useCallback } from 'react';
import { GameProvider, useGameContext } from './context/GameContext';
import { Toaster } from 'react-hot-toast';
import FakeWarningToast from './components/ui/FakeWarningToast';
import ErrorBoundary from './components/ui/ErrorBoundary';
import EarthCanvas from './components/3d/EarthCanvas';

import SplashScreen from './components/screens/SplashScreen';
import CityRevealScreen from './components/screens/CityRevealScreen';
import WarningScreen from './components/screens/WarningScreen';
import AllocationScreen from './components/screens/AllocationScreen';
import OutcomeScreen from './components/screens/OutcomeScreen';
import FinalScoreScreen from './components/screens/FinalScoreScreen';
import LeaderboardScreen from './components/screens/LeaderboardScreen';

// Screens where ambient warning toasts may appear
const MISSION_SCREENS = ['WarningScreen', 'AllocationScreen', 'OutcomeScreen'];

function AppContent() {
  const [currentScreen, setCurrentScreen] = useState('SplashScreen');
  const [transitionStage, setTransitionStage] = useState('idle');
  const { state } = useGameContext();

  const handleStageComplete = useCallback((completedStage) => {
    switch (completedStage) {
      case 'clearing':
        setTransitionStage('centering');
        break;
      case 'centering':
        setTransitionStage('revolving');
        break;
      case 'revolving':
        setTransitionStage('locking_india');
        break;
      case 'locking_india':
        setTransitionStage('zooming_india');
        break;
      case 'zooming_india':
        setTransitionStage('zooming_city');
        break;
      case 'zooming_city':
        setTransitionStage('revealed');
        break;
      default:
        break;
    }
  }, []);

  const handleStartTransition = useCallback(() => {
    if (transitionStage === 'idle') {
      setTransitionStage('clearing');
    }
  }, [transitionStage]);

  const handleResetToSplash = useCallback(() => {
    setTransitionStage('idle');
    setCurrentScreen('SplashScreen');
  }, []);

  const canvasStage = currentScreen === 'SplashScreen'
    ? transitionStage
    : currentScreen === 'CityRevealScreen'
      ? 'revealed'
      : 'idle';

  return (
    <>
      {/* Persistent 3D Earth & Starfield Scene */}
      <EarthCanvas
        assignedCity={state.city}
        transitionStage={canvasStage}
        onStageComplete={handleStageComplete}
      />

      {/* Dims the globe behind the mission screens so their panels stay readable */}
      <div
        aria-hidden="true"
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          background: 'rgba(3, 7, 13, 0.68)',
          opacity: currentScreen === 'SplashScreen' ? 0 : 1,
          transition: 'opacity 0.7s ease',
        }}
      />

      <FakeWarningToast active={MISSION_SCREENS.includes(currentScreen)} />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'rgba(5, 15, 29, 0.95)',
            color: '#b8e1fc',
            border: '1px solid rgba(0, 240, 255, 0.3)',
            fontFamily: '"Share Tech Mono", monospace',
            fontSize: '12px',
            boxShadow: '0 0 15px rgba(0, 240, 255, 0.15)',
          },
        }}
      />

      {currentScreen === 'SplashScreen' && (
        <SplashScreen
          transitionStage={transitionStage}
          onStartTransition={handleStartTransition}
          onNext={() => setCurrentScreen('WarningScreen')}
        />
      )}

      {currentScreen === 'CityRevealScreen' && (
        <CityRevealScreen onNext={() => setCurrentScreen('WarningScreen')} />
      )}

      {currentScreen === 'WarningScreen' && (
        <WarningScreen onNext={() => setCurrentScreen('AllocationScreen')} />
      )}

      {currentScreen === 'AllocationScreen' && (
        <AllocationScreen onNext={() => setCurrentScreen('OutcomeScreen')} />
      )}

      {currentScreen === 'OutcomeScreen' && (
        <OutcomeScreen onNext={(next) => setCurrentScreen(next)} />
      )}

      {currentScreen === 'FinalScoreScreen' && (
        <FinalScoreScreen onNext={() => setCurrentScreen('LeaderboardScreen')} />
      )}

      {currentScreen === 'LeaderboardScreen' && (
        <LeaderboardScreen onNext={handleResetToSplash} />
      )}
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <GameProvider>
        <AppContent />
      </GameProvider>
    </ErrorBoundary>
  );
}
