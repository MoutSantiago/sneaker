export declare class PrismaServiceMock {
    $connect: jest.Mock<any, any, any>;
    $disconnect: jest.Mock<any, any, any>;
    $transaction: jest.Mock<any, any, any>;
    $executeRaw: jest.Mock<any, any, any>;
    $queryRaw: jest.Mock<any, any, any>;
    readonly __isPrismaServiceMock = true;
}
export declare const mockPrismaProvider: {
    provide: typeof PrismaServiceMock;
    useClass: typeof PrismaServiceMock;
};
export declare class PrismaTestModule {
}
