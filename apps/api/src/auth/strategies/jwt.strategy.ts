import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ConfigService } from "@nestjs/config";
import { ExtractJwt, Strategy } from "passport-jwt";
import { UserRole } from "@pinus/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { JwtPayload } from "../auth.service";
import { AuthenticatedUser } from "../../common/decorators/current-user.decorator";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>("JWT_ACCESS_SECRET")!,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException("Sesi tidak valid");
    }
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      // Prisma's generated UserRole enum is structurally identical to
      // @pinus/shared's but nominally distinct; this is the single point
      // where the raw DB value becomes the typed shared enum every guard
      // and controller relies on.
      role: user.role as unknown as UserRole,
      employeeId: user.employeeId,
    };
  }
}
