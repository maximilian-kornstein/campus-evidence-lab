def pytest_configure(config):
    config.addinivalue_line("markers", "slow: Monte Carlo tests that take longer than a few seconds")
