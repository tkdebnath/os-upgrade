class ActivationStrategyRegistry:
    _strategies = []
    
    @classmethod
    def register(cls, strategy_class):
        if strategy_class not in cls._strategies:
            cls._strategies.append(strategy_class)
        return strategy_class
    
    @classmethod
    def get_strategy(cls, device, job, logger):
        for strategy_class in cls._strategies:
            strategy = strategy_class(device, job, logger)
            if strategy.can_handle(device):
                return strategy
        return None
    
    @classmethod
    def list_strategies(cls):
        return cls._strategies.copy()
    
    @classmethod
    def clear(cls):
        """Clear all registered strategies (mainly for testing)."""
        cls._strategies = []
