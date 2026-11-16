import { useNavigate } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';

/** Real 404 state rather than a blank route. */
export const NotFoundPage = () => {
  const navigate = useNavigate();
  return (
    <div className="panel mx-auto mt-10 max-w-lg">
      <EmptyState
        icon={<Compass className="size-5" />}
        title="Page not found"
        description="That route does not exist in PIXIORA. Your loaded images are still in memory — nothing was lost."
        action={
          <Button variant="primary" size="sm" onClick={() => navigate('/')}>
            Back to Compressor
          </Button>
        }
      />
    </div>
  );
};
